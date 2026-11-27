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
  order: vec4f, // depth slab, slab count, back-cover blend, unused
};

@group(0) @binding(0) var<uniform> G: Globals;
@group(0) @binding(1) var<storage, read> books: array<Book>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var covers: texture_2d_array<f32>;
@group(0) @binding(4) var spines: texture_2d_array<f32>;
@group(0) @binding(5) var closeup: texture_2d<f32>;
@group(0) @binding(6) var backCover: texture_2d<f32>;

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
  let uvBack = vec2f(0.5 - f.local.x / w, 0.5 - f.local.y / h);
  let uvSpine = vec2f(f.local.z / t + 0.5, 0.5 - f.local.y / h);
  let coverA = textureSampleBias(covers, samp, uvCover, layer, -0.15).rgb;
  let coverB = textureSampleBias(closeup, samp, uvCover, -0.15).rgb;
  let backTex = textureSampleBias(backCover, samp, uvBack, -0.15).rgb;
  let spine = textureSample(spines, samp, uvSpine, layer).rgb;
  let fz = fwidth(f.local.z);
  // Subtle anti-aliased cloth weave in local book coordinates.
  let weaveCoord = select(f.local.xy, f.local.zy, abs(f.face.x) > 0.5) * 1.15;
  let weaveFw = max(fwidth(weaveCoord.x), fwidth(weaveCoord.y));
  let weaveFade = 1.0 - smoothstep(0.25, 0.85, weaveFw);
  let weave = (sin(weaveCoord.x * 6.2831853) + sin(weaveCoord.y * 6.2831853)) * 0.5 * weaveFade;
  let weaveDx = cos(weaveCoord.x * 6.2831853) * weaveFade;
  let weaveDy = cos(weaveCoord.y * 6.2831853) * weaveFade;

  var N = normalize(f.normal);
  let tX = normalize((b.model * vec4f(1.0, 0.0, 0.0, 0.0)).xyz);
  let tY = normalize((b.model * vec4f(0.0, 1.0, 0.0, 0.0)).xyz);
  let tZ = normalize((b.model * vec4f(0.0, 0.0, 1.0, 0.0)).xyz);
  let V = normalize(G.camPos - f.world);
  let jacket = b.tint.rgb;
  var albedo = jacket;
  var gloss = 0.35;
  var foilTint = vec3f(1.0);

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
    let stock = mix(0.036, 0.012, b.misc.x);
    albedo *= 1.0 + stock * 0.55 * weave;
    N = normalize(N + tX * (-gx * groove * 0.35 + weaveDx * stock) + tY * (weaveDy * stock));
    // Turned edges catch a little less light.
    let edge = min(min(uvCover.x, 1.0 - uvCover.x) * w, min(uvCover.y, 1.0 - uvCover.y) * h);
    albedo *= mix(0.86, 1.0, smoothstep(0.0, 1.6, edge));
    gloss = 1.0;
  } else if (f.face.z < -0.5) {
    let gx = (uvCover.x - 0.048) / 0.016;
    let plain = jacket * mix(0.9, 1.0, uvCover.y);
    let backSurface = mix(plain, backTex, b.order.z);
    let foil = smoothstep(0.08, 0.28, length(backTex - jacket)) * b.order.z;
    albedo = backSurface * (1.0 - 0.14 * exp(-gx * gx)) * (1.0 + 0.022 * weave);
    N = normalize(N + tX * (weaveDx * 0.042) + tY * (weaveDy * 0.042));
    gloss = mix(0.62, 1.28, foil);
    foilTint = mix(vec3f(1.0), vec3f(1.0, 0.94, 0.82), foil);
  } else if (f.face.x < -0.5) {
    // Spine, gently rounded, with subtle linen tooth and foil lettering sheen.
    let s = uvSpine.x * 2.0 - 1.0;
    let foil = smoothstep(0.06, 0.24, length(spine - jacket));
    albedo = spine * (1.0 - 0.22 * s * s * s * s) * (1.0 + 0.02 * weave);
    N = normalize(N + tZ * (s * 0.55 + weaveDx * 0.038) + tY * (weaveDy * 0.038));
    gloss = mix(0.55, 1.35, foil);
    foilTint = mix(vec3f(1.0), vec3f(1.0, 0.94, 0.82), foil);
  } else {
    albedo = jacket * 0.78 * (1.0 + 0.018 * weave);
  }

  let L = G.lightDir;
  let ndl = max(dot(N, L), 0.0);
  let sky = mix(0.33, 0.47, N.y * 0.5 + 0.5);
  // Light coming back up off the paper keeps the shaded edges readable.
  let bounce = 0.30 * (1.0 - abs(N.z)) * vec3f(1.0, 0.96, 0.88);
  var lit = albedo * (sky + 0.80 * ndl + bounce);

  let R = reflect(-V, N);
  let s = max(dot(R, G.softbox), 0.0);
  lit += foilTint * gloss * (0.20 * smoothstep(0.93, 0.995, s) + 0.07 * pow(s, 5.0));

  // Soft shoulder instead of a hard clip.
  let over = max(lit - vec3f(0.86), vec3f(0.0));
  lit = min(lit, vec3f(0.86)) + 0.14 * (vec3f(1.0) - exp(-over / 0.14));

  let a = b.tint.a;
  return vec4f(encode(lit) * a, a);
}

@fragment
fn fsDepth(f: VOut) -> @location(0) vec4f {
  if (f.part == 4u) {
    let b = books[f.inst];
    let rx = (f.local.x / b.dims.x - 0.135) / 0.035;
    let ry = (-f.local.y / b.dims.y - 0.5) / 0.045;
    if (ry > 0.6 + 0.4 * abs(rx)) {
      discard;
    }
  }
  return vec4f(0.0);
}
`;

export const MIP_WGSL = /* wgsl */ `
@group(0) @binding(0) var mipSamp: sampler;
@group(0) @binding(1) var mipSrc: texture_2d<f32>;

struct MipOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> MipOut {
  var pts = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  let p = pts[i];
  var o: MipOut;
  o.pos = vec4f(p, 0.0, 1.0);
  o.uv = vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  return o;
}

@fragment
fn fs(f: MipOut) -> @location(0) vec4f {
  return textureSample(mipSrc, mipSamp, f.uv);
}
`;

export const SHADOW_WGSL = /* wgsl */ `${COMMON}
struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) p: vec2f,
  @location(1) @interpolate(flat) drop: vec4f,   // centre, half extents along its own axes
  @location(2) @interpolate(flat) axes: vec4f,   // orthonormal shadow axes (e1, e2)
  @location(3) @interpolate(flat) halo: vec4f,   // centre, half extents
  @location(4) @interpolate(flat) soft: vec4f,   // drop sigma, drop alpha, halo sigma, halo alpha
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) i: u32) -> VOut {
  let b = books[i];
  var o: VOut;
  if (b.tint.a <= 0.002) {
    o.pos = vec4f(0.0, 0.0, 2.0, 1.0);
    return o;
  }

  let c = b.model[3].xyz;
  let ax = b.model[0].xyz * b.dims.x * 0.5;
  let ay = b.model[1].xyz * b.dims.y * 0.5;
  let az = b.model[2].xyz * b.dims.z * 0.5;
  let ground = b.misc.z;
  let slope = G.lightDir.xy / G.lightDir.z;

  // Project the book along the light onto the paper and align an orthonormal
  // shadow basis to its tall axis so spinning edge-on never snaps or inverts.
  let px = ax.xy - slope * ax.z;
  let py = ay.xy - slope * ay.z;
  let pz = az.xy - slope * az.z;
  let lx = length(px);
  let ly = length(py);
  let e1 = select(px / max(lx, 0.001), py / max(ly, 0.001), ly >= lx * 0.25);
  let e2 = vec2f(-e1.y, e1.x);
  let half = vec2f(
    abs(dot(px, e1)) + abs(dot(py, e1)) + abs(dot(pz, e1)),
    abs(dot(px, e2)) + abs(dot(py, e2)) + abs(dot(pz, e2)),
  );
  let dropC = c.xy - slope * (c.z - ground);
  let haloHalf = abs(ax.xy) + abs(ay.xy) + abs(az.xy);

  let rise = abs(ax.z) + abs(ay.z) + abs(az.z);
  let gap = max(0.0, c.z - ground - rise);
  let dropSigma = 1.4 + rise * 0.11 + gap * 0.17;
  let haloSigma = 9.0 + rise * 0.30 + gap * 0.5;
  let dropAlpha = (0.40 / (1.0 + gap / 190.0)) * b.tint.a;
  let rawHalo = (0.20 / (1.0 + gap / 45.0)) * b.tint.a;
  let haloAlpha = rawHalo * smoothstep(0.003, 0.009, rawHalo);

  // Size each shadow quad tightly to the visible Gaussian tail.
  let dropK = clamp(1.4 + 2.1 * sqrt(dropAlpha), 1.6, 3.1);
  let reach = half.x * abs(e1) + half.y * abs(e2) + vec2f(dropSigma * dropK);
  var lo = dropC - reach;
  var hi = dropC + reach;
  if (haloAlpha > 0.0) {
    let haloK = clamp(1.3 + 2.2 * sqrt(haloAlpha), 1.5, 2.9);
    let haloReach = haloHalf + vec2f(haloSigma * haloK);
    lo = min(lo, c.xy - haloReach);
    hi = max(hi, c.xy + haloReach);
  }
  var quad = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  let p = mix(lo, hi, quad[vi]);

  o.pos = G.viewProj * vec4f(p, ground, 1.0);
  o.p = p;
  o.drop = vec4f(dropC, half);
  o.axes = vec4f(e1, e2);
  o.halo = vec4f(c.xy, haloHalf);
  o.soft = vec4f(dropSigma, dropAlpha, haloSigma, haloAlpha);
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
  let halo = select(0.0, f.soft.w * blurred(f.p - f.halo.xy, f.halo.zw, f.soft.z), f.soft.w > 0.0);
  let a = (1.0 - (1.0 - drop) * (1.0 - halo)) * G.shadowStrength;
  return vec4f(encode(G.shadowColor) * a, a);
}
`;
