export const WATER_COMPUTE_WGSL = /* wgsl */ `
struct SimParams {
  grid: vec4<f32>,    // x: width, y: height, z: damping, w: c2
  pointer: vec4<f32>, // x: simU, y: simV, z: strength, w: radius
  ambient: vec4<f32>, // x: simU, y: simV, z: strength, w: radius
};

@group(0) @binding(0) var<uniform> params: SimParams;
@group(0) @binding(1) var<storage, read> hPrev: array<f32>;
@group(0) @binding(2) var<storage, read> hCurr: array<f32>;
@group(0) @binding(3) var<storage, read_write> hNext: array<f32>;

@compute @workgroup_size(16, 16)
fn stepWater(@builtin(global_invocation_id) id: vec3<u32>) {
  let w = u32(params.grid.x);
  let h = u32(params.grid.y);
  if (id.x >= w || id.y >= h) {
    return;
  }

  let idx = id.y * w + id.x;

  if (id.x == 0u || id.x == w - 1u || id.y == 0u || id.y == h - 1u) {
    hNext[idx] = 0.0;
    return;
  }

  let c = hCurr[idx];
  let p = hPrev[idx];

  // 9-point isotropic Laplacian for circular wave propagation
  let n = hCurr[idx - w];
  let s = hCurr[idx + w];
  let e = hCurr[idx + 1u];
  let west = hCurr[idx - 1u];

  let ne = hCurr[idx - w + 1u];
  let nw = hCurr[idx - w - 1u];
  let se = hCurr[idx + w + 1u];
  let sw = hCurr[idx + w - 1u];

  let laplacian = (n + s + e + west) * 0.8 + (ne + nw + se + sw) * 0.2 - 4.0 * c;

  let c2 = params.grid.w;
  var damping = params.grid.z;

  // Soft absorbing sponge around the perimeter
  let u = f32(id.x) / params.grid.x;
  let v = f32(id.y) / params.grid.y;
  let edgeDist = min(min(u, 1.0 - u), min(v * 1.4, 1.0 - v));
  if (edgeDist < 0.07) {
    damping = damping * mix(0.90, 1.0, edgeDist / 0.07);
  }

  var nextVal = (2.0 * c - p + c2 * laplacian) * damping;

  let aspect = params.grid.x / params.grid.y;

  if (abs(params.pointer.z) > 0.0001) {
    let du = (u - params.pointer.x) * aspect;
    let dv = v - params.pointer.y;
    let d2 = du * du + dv * dv;
    let r2 = params.pointer.w * params.pointer.w;
    if (d2 < r2 * 6.0) {
      nextVal += params.pointer.z * exp(-d2 / max(r2, 1e-6));
    }
  }

  if (abs(params.ambient.z) > 0.0001) {
    let du = (u - params.ambient.x) * aspect;
    let dv = v - params.ambient.y;
    let d2 = du * du + dv * dv;
    let r2 = params.ambient.w * params.ambient.w;
    if (d2 < r2 * 6.0) {
      nextVal += params.ambient.z * exp(-d2 / max(r2, 1e-6));
    }
  }

  hNext[idx] = clamp(nextVal, -1.6, 1.6);
}
`;

export const WATER_RENDER_WGSL = /* wgsl */ `
struct RenderParams {
  viewport: vec4<f32>, // x: canvasW, y: canvasH, z: imgW, w: imgH
  sim: vec4<f32>,      // x: gridW, y: gridH, z: time, w: horizonImgV
};

struct VertexOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var<uniform> params: RenderParams;
@group(0) @binding(1) var photoSampler: sampler;
@group(0) @binding(2) var photoTex: texture_2d<f32>;
@group(0) @binding(3) var<storage, read> heightField: array<f32>;

@vertex
fn vsMain(@builtin(vertex_index) vid: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  let p = positions[vid];
  var out: VertexOut;
  out.pos = vec4<f32>(p, 0.0, 1.0);
  out.uv = vec2<f32>((p.x + 1.0) * 0.5, (1.0 - p.y) * 0.5);
  return out;
}

fn coverUV(uv: vec2<f32>, canvasW: f32, canvasH: f32, imgW: f32, imgH: f32) -> vec2<f32> {
  let canvasAspect = canvasW / max(canvasH, 1.0);
  let imgAspect = imgW / max(imgH, 1.0);
  var scale = vec2<f32>(1.0, 1.0);
  if (canvasAspect > imgAspect) {
    scale.y = imgAspect / canvasAspect;
  } else {
    scale.x = canvasAspect / imgAspect;
  }
  return (uv - 0.5) * scale + 0.5;
}

fn readCell(ix: i32, iy: i32, gw: i32, gh: i32) -> f32 {
  let cx = clamp(ix, 0, gw - 1);
  let cy = clamp(iy, 0, gh - 1);
  return heightField[cy * gw + cx];
}

fn sampleHeight(u: f32, v: f32) -> f32 {
  let gw = i32(params.sim.x);
  let gh = i32(params.sim.y);
  let fx = clamp(u, 0.0, 1.0) * (params.sim.x - 1.0);
  let fy = clamp(v, 0.0, 1.0) * (params.sim.y - 1.0);
  let x0 = i32(floor(fx));
  let y0 = i32(floor(fy));
  let tx = fx - f32(x0);
  let ty = fy - f32(y0);

  let h00 = readCell(x0, y0, gw, gh);
  let h10 = readCell(x0 + 1, y0, gw, gh);
  let h01 = readCell(x0, y0 + 1, gw, gh);
  let h11 = readCell(x0 + 1, y0 + 1, gw, gh);

  return mix(mix(h00, h10, tx), mix(h01, h11, tx), ty);
}

fn windSlope(p: vec2<f32>, t: f32) -> vec2<f32> {
  let w1 = sin(p.x * 26.0 + p.y * 58.0 - t * 0.95);
  let w2 = cos(p.x * 41.0 - p.y * 84.0 + t * 0.72);
  let w3 = sin(p.x * 15.0 + p.y * 34.0 + t * 0.48);
  let sx = (w1 * 0.42 + w2 * 0.34 + w3 * 0.24) * 0.0024;
  let sy = (w1 * 0.58 - w2 * 0.46 + w3 * 0.32) * 0.0048;
  return vec2<f32>(sx, sy);
}

@fragment
fn fsMain(in: VertexOut) -> @location(0) vec4<f32> {
  let imgUV = coverUV(
    in.uv,
    params.viewport.x,
    params.viewport.y,
    params.viewport.z,
    params.viewport.w
  );

  let horizon = params.sim.w;
  let safeUV = clamp(imgUV, vec2<f32>(0.001), vec2<f32>(0.999));
  let basePhoto = textureSampleLevel(photoTex, photoSampler, safeUV, 0.0).rgb;

  let waterMask = smoothstep(horizon - 0.006, horizon + 0.022, imgUV.y);
  let wy = clamp((imgUV.y - horizon) / max(1.0 - horizon, 0.001), 0.0, 1.0);
  let simU = in.uv.x;
  let simV = pow(max(wy, 0.0001), 0.72);

  let du = 1.0 / params.sim.x;
  let dv = 1.0 / params.sim.y;

  let hL = sampleHeight(simU - du, simV);
  let hR = sampleHeight(simU + du, simV);
  let hU = sampleHeight(simU, simV - dv);
  let hD = sampleHeight(simU, simV + dv);

  let gradX = (hR - hL) * 0.5;
  let gradY = (hD - hU) * 0.5;

  let persp = mix(0.42, 1.2, wy);
  let breeze = windSlope(vec2<f32>(imgUV.x, wy * 1.65), params.sim.z) * (0.45 + 0.55 * wy);

  let slope = vec2<f32>(gradX * 0.16 * persp, gradY * 0.21 * persp) + breeze;
  let normal = normalize(vec3<f32>(-slope.x * 16.0, 1.0, -slope.y * 16.0));

  let minWater = vec2<f32>(0.001, horizon);
  let maxWater = vec2<f32>(0.999, 0.999);
  let refractUV = clamp(imgUV + slope * vec2<f32>(0.95, 1.25), minWater, maxWater);
  let disp = slope * 0.16;

  let rChan = textureSampleLevel(photoTex, photoSampler, clamp(refractUV + disp, minWater, maxWater), 0.0).r;
  let gChan = textureSampleLevel(photoTex, photoSampler, refractUV, 0.0).g;
  let bChan = textureSampleLevel(photoTex, photoSampler, clamp(refractUV - disp, minWater, maxWater), 0.0).b;
  let refracted = vec3<f32>(rChan, gChan, bChan);

  let mirrorY = clamp(horizon - (imgUV.y - horizon) * 0.88 - slope.y * 1.45, 0.002, horizon - 0.002);
  let mirrorX = clamp(imgUV.x + slope.x * 1.15, 0.002, 0.998);
  let reflected = textureSampleLevel(photoTex, photoSampler, vec2<f32>(mirrorX, mirrorY), 0.0).rgb;

  let viewDir = normalize(vec3<f32>(0.0, mix(0.18, 0.62, wy), 1.0));
  let ndotv = clamp(dot(normal, viewDir), 0.0, 1.0);
  let fresnel = 0.04 + 0.42 * pow(1.0 - ndotv, 3.2);

  let waveEnergy = clamp(length(vec2<f32>(gradX, gradY)) * 6.5, 0.0, 1.0);
  var waterColor = mix(refracted, reflected * vec3<f32>(0.84, 0.91, 0.94), fresnel * (0.30 + 0.38 * waveEnergy));

  let lightDir = normalize(vec3<f32>(0.18, 0.42, -0.88));
  let halfVec = normalize(lightDir + viewDir);
  let spec = pow(clamp(dot(normal, halfVec), 0.0, 1.0), 38.0);
  let skyTint = vec3<f32>(0.78, 0.90, 0.94);
  waterColor += skyTint * spec * (0.10 + 0.36 * waveEnergy);

  let crest = clamp((gradY * -1.4 + gradX * 0.5) * persp, -0.35, 0.35);
  waterColor *= 1.0 + crest * 0.14;

  let finalRgb = mix(basePhoto, waterColor, waterMask);
  return vec4<f32>(finalRgb, 1.0);
}
`;
