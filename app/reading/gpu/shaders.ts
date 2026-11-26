// WGSL for the reading list. Two draws share one bind group: soft shadows on
// the paper, then the books themselves.

const COMMON = /* wgsl */ `
struct Globals {
  viewProj: mat4x4f,
  camPos: vec3f,
  time: f32,
  lightDir: vec3f,
  dpr: f32,
  softbox: vec3f,
  shadowStrength: f32,
  shadowColor: vec3f,
  pad: f32,
};

struct Book {
  model: mat4x4f,
  dims: vec4f,  // width, height, thickness, texture layer
  tint: vec4f,  // jacket colour (linear), alpha
  misc: vec4f,  // cover loaded, high-res cover, ground z, seed (+2 if read)
  order: vec4f, // depth slab, slab count
};

@group(0) @binding(0) var<uniform> G: Globals;
@group(0) @binding(1) var<storage, read> books: array<Book>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var covers: texture_2d_array<f32>;
@group(0) @binding(4) var spines: texture_2d_array<f32>;
@group(0) @binding(5) var closeup: texture_2d<f32>;

fn encode(c: vec3f) -> vec3f {
  let lo = c * 12.92;
  let hi = 1.055 * pow(max(c, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055;
  return select(hi, lo, c <= vec3f(0.0031308));
}

fn hash1(x: f32) -> f32 {
  return fract(sin(x * 127.1 + 11.7) * 43758.5453);
}
`;

export const BOOK_WGSL = /* wgsl */ `${COMMON}
struct VIn {
  @location(0) corner: vec3f,
  @location(1) boardK: vec3f,
  @location(2) insetK: vec3f,
  @location(3) normal: vec3f,
  @location(4) part: f32,
};

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
  @location(2) local: vec3f,
  @location(3) @interpolate(flat) face: vec3f,
  @location(4) @interpolate(flat) part: u32,
  @location(5) @interpolate(flat) inst: u32,
};

fn boardOf(b: Book) -> f32 {
  return min(max(1.1, b.dims.y * 0.0105), b.dims.z * 0.17);
}

@vertex
fn vs(v: VIn, @builtin(instance_index) i: u32) -> VOut {
  let b = books[i];
  let board = boardOf(b);
  let inset = board * 1.15;
  var local = v.corner * 0.5 * b.dims.xyz + v.boardK * board + v.insetK * inset;
  // Only books that have been read carry the ribbon.
  if (v.part > 3.5 && b.misc.w < 1.5) {
    local = vec3f(0.0);
  }
  let world = b.model * vec4f(local, 1.0);
  var o: VOut;
  o.pos = G.viewProj * world;

  // Drifting books tilt freely and would cut through one another, so each
  // gets its own slab of the depth range: whole books sort against each
  // other, while a book's own faces still sort correctly within its slab.
  // Slab 0 is shared by the books on the shelves, which keep true depth.
  let own = o.pos.z / o.pos.w;
  var within = 1.0 - own;
  if (b.order.x > 0.5) {
    let reach = length(b.dims.xyz) * 0.56 * length(b.model[0].xyz);
    let front = G.viewProj * vec4f(0.0, 0.0, b.model[3].z + reach, 1.0);
    let back = G.viewProj * vec4f(0.0, 0.0, b.model[3].z - reach, 1.0);
    let far = back.z / back.w;
    within = (far - own) / (far - front.z / front.w);
  }
  let depth = 1.0 - (b.order.x + mix(0.02, 0.98, clamp(within, 0.0, 1.0))) / b.order.y;
  o.pos.z = depth * o.pos.w;

  // A faded-out book must not hide the ones behind it.
  if (b.tint.a <= 0.0) {
    o.pos = vec4f(0.0, 0.0, 2.0, 1.0);
  }
  o.world = world.xyz;
  o.normal = (b.model * vec4f(v.normal, 0.0)).xyz;
  o.local = local;
  o.face = v.normal;
  o.part = u32(v.part);
  o.inst = i;
  return o;
}

@fragment
fn fs(f: VOut) -> @location(0) vec4f {
  let b = books[f.inst];
  let w = b.dims.x;
  let h = b.dims.y;
  let t = b.dims.z;
  let layer = i32(b.dims.w);
  let board = boardOf(b);

  let uvCover = vec2f(f.local.x / w + 0.5, 0.5 - f.local.y / h);
  let uvSpine = vec2f(f.local.z / t + 0.5, 0.5 - f.local.y / h);
  let coverA = textureSampleBias(covers, samp, uvCover, layer, -0.35).rgb;
  let coverB = textureSampleBias(closeup, samp, uvCover, -0.25).rgb;
  let spine = textureSample(spines, samp, uvSpine, layer).rgb;
  let fz = fwidth(f.local.z);

  var N = normalize(f.normal);
  let V = normalize(G.camPos - f.world);
  let jacket = b.tint.rgb;
  var albedo = jacket;
  var gloss = 0.35;

  if (f.part == 4u) {
    // Ribbon marker with a swallowtail end.
    let rx = (f.local.x / w - 0.135) / 0.035;
    let ry = (-f.local.y / h - 0.5) / 0.045;
    if (ry > 0.6 + 0.4 * abs(rx)) {
      discard;
    }
    albedo = vec3f(0.36, 0.035, 0.045) * mix(0.82, 1.0, abs(rx));
    gloss = 0.5;
  } else if (f.part == 3u) {
    // Page block: cream paper, individual leaves hinted along the thickness.
    let leaf = floor(f.local.z * 1.35);
    let grain = mix(0.80, 1.0, hash1(leaf + fract(b.misc.w) * 91.0));
    let fade = 1.0 - smoothstep(0.3, 1.1, fz * 1.35);
    let depth = min(t * 0.5 - board - abs(f.local.z), 6.0) / 6.0;
    let nook = mix(0.62, 1.0, smoothstep(0.0, 1.0, depth));
    albedo = vec3f(0.90, 0.855, 0.76) * mix(0.92, grain, fade) * nook;
    gloss = 0.0;
  } else if (f.face.z > 0.5) {
    let cover = mix(coverA, coverB, b.misc.y);
    albedo = mix(jacket, cover, b.misc.x);
    // The hinge: a shallow groove where the board meets the spine.
    let gx = (uvCover.x - 0.048) / 0.016;
    let groove = exp(-gx * gx);
    albedo *= 1.0 - 0.16 * groove;
    N = normalize(N + (b.model * vec4f(1.0, 0.0, 0.0, 0.0)).xyz * (-gx * groove * 0.35));
    // Turned edges catch a little less light.
    let edge = min(min(uvCover.x, 1.0 - uvCover.x) * w, min(uvCover.y, 1.0 - uvCover.y) * h);
    albedo *= mix(0.86, 1.0, smoothstep(0.0, 1.6, edge));
    gloss = 1.0;
  } else if (f.face.z < -0.5) {
    let gx = (uvCover.x - 0.048) / 0.016;
    albedo = jacket * (1.0 - 0.14 * exp(-gx * gx)) * mix(0.9, 1.0, uvCover.y);
    gloss = 0.8;
  } else if (f.face.x < -0.5) {
    // Spine, gently rounded.
    let s = uvSpine.x * 2.0 - 1.0;
    albedo = spine * (1.0 - 0.22 * s * s * s * s);
    N = normalize(N + (b.model * vec4f(0.0, 0.0, 1.0, 0.0)).xyz * s * 0.55);
    gloss = 0.7;
  } else {
    albedo = jacket * 0.78;
  }

  let L = G.lightDir;
  let ndl = max(dot(N, L), 0.0);
  let sky = mix(0.33, 0.47, N.y * 0.5 + 0.5);
  // Light coming back up off the paper keeps the shaded edges readable.
  let bounce = 0.30 * (1.0 - abs(N.z)) * vec3f(1.0, 0.96, 0.88);
  var lit = albedo * (sky + 0.80 * ndl + bounce);

  let R = reflect(-V, N);
  let s = max(dot(R, G.softbox), 0.0);
  lit += gloss * (0.20 * smoothstep(0.93, 0.995, s) + 0.07 * pow(s, 5.0));

  // Soft shoulder instead of a hard clip.
  let over = max(lit - vec3f(0.86), vec3f(0.0));
  lit = min(lit, vec3f(0.86)) + 0.14 * (vec3f(1.0) - exp(-over / 0.14));

  let a = b.tint.a;
  return vec4f(encode(lit) * a, a);
}
`;

export const SHADOW_WGSL = /* wgsl */ `${COMMON}
struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) p: vec2f,
  @location(1) @interpolate(flat) drop: vec4f,   // centre, half extents along its own axes
  @location(2) @interpolate(flat) axes: vec4f,   // world → shadow axes (two rows)
  @location(3) @interpolate(flat) halo: vec4f,   // centre, half extents
  @location(4) @interpolate(flat) soft: vec4f,   // drop sigma, drop alpha, halo sigma, halo alpha
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) i: u32) -> VOut {
  let b = books[i];
  let c = b.model[3].xyz;
  let ax = b.model[0].xyz * b.dims.x * 0.5;
  let ay = b.model[1].xyz * b.dims.y * 0.5;
  let az = b.model[2].xyz * b.dims.z * 0.5;
  let ground = b.misc.z;
  let slope = G.lightDir.xy / G.lightDir.z;

  // Slide the book along the light onto the paper. Its cover lands as a
  // parallelogram; the thickness just fattens that a little.
  let px = ax.xy - slope * ax.z;
  let py = ay.xy - slope * ay.z;
  let pz = az.xy - slope * az.z;
  let lx = max(length(px), 0.001);
  let ly = max(length(py), 0.001);
  let ux = px / lx;
  let uy = py / ly;
  let cross = ux.x * uy.y - ux.y * uy.x;
  let det = select(-1.0, 1.0, cross >= 0.0) * max(abs(cross), 0.3);
  let half = vec2f(lx + abs(dot(pz, ux)), ly + abs(dot(pz, uy)));
  let dropC = c.xy - slope * (c.z - ground);
  let haloHalf = abs(ax.xy) + abs(ay.xy) + abs(az.xy);

  let rise = abs(ax.z) + abs(ay.z) + abs(az.z);
  let gap = max(0.0, c.z - ground - rise);
  let dropSigma = 1.4 + rise * 0.11 + gap * 0.17;
  let haloSigma = 9.0 + rise * 0.30 + gap * 0.5;
  let dropAlpha = 0.40 / (1.0 + gap / 190.0);
  let haloAlpha = 0.20 / (1.0 + gap / 45.0);

  let reach = half.x * abs(ux) + half.y * abs(uy) + vec2f(dropSigma * 4.5);
  let lo = min(dropC - reach, c.xy - haloHalf - haloSigma * 3.2);
  let hi = max(dropC + reach, c.xy + haloHalf + haloSigma * 3.2);
  var quad = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  let p = mix(lo, hi, quad[vi]);

  var o: VOut;
  o.pos = G.viewProj * vec4f(p, ground, 1.0);
  o.p = p;
  o.drop = vec4f(dropC, half);
  o.axes = vec4f(uy.y, -uy.x, -ux.y, ux.x) / det;
  o.halo = vec4f(c.xy, haloHalf);
  o.soft = vec4f(dropSigma / sqrt(abs(det)), dropAlpha * b.tint.a, haloSigma, haloAlpha * b.tint.a);
  return o;
}

fn erf2(x: vec2f) -> vec2f {
  let a = abs(x);
  let d = 1.0 + a * (0.278393 + a * (0.230389 + a * (0.000972 + a * 0.078108)));
  let d2 = d * d;
  return sign(x) * (1.0 - 1.0 / (d2 * d2));
}

// Gaussian blur of a rectangle, in closed form.
fn blurred(p: vec2f, half: vec2f, sigma: f32) -> f32 {
  let k = 0.70710678 / sigma;
  let e = 0.5 * (erf2((half - p) * k) + erf2((half + p) * k));
  return e.x * e.y;
}

@fragment
fn fs(f: VOut) -> @location(0) vec4f {
  let d = f.p - f.drop.xy;
  let along = vec2f(dot(d, f.axes.xy), dot(d, f.axes.zw));
  let drop = f.soft.y * blurred(along, f.drop.zw, f.soft.x);
  let halo = f.soft.w * blurred(f.p - f.halo.xy, f.halo.zw, f.soft.z);
  let a = (1.0 - (1.0 - drop) * (1.0 - halo)) * G.shadowStrength;
  return vec4f(encode(G.shadowColor) * a, a);
}
`;
