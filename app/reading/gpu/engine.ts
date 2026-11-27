/// <reference types="@webgpu/types" />
//
// The reading list's renderer. Every book is a real box (two boards, a spine and
// a page block) lit in WebGPU and drawn on a transparent canvas that sits over
// the page. The page lays the books out in ordinary DOM; this file reads those
// positions and decides where each book is right now: adrift in the stream at
// the top of the page, settled on its shelf, or held up close.
//
// One world unit is one CSS pixel on the paper (z = 0), with the camera above
// the middle of the viewport. The canvas scrolls with the document and is moved
// under the viewport each frame, so books never lag behind their captions.

import { BOOK_WGSL, MIP_WGSL, SHADOW_WGSL } from "./shaders";
import { drawCloth, drawSpine } from "./typeset";

export type EngineBook = {
  title: string;
  author: string;
  /** width / height */
  aspect: number;
  /** thickness / width */
  thick: number;
  /** jacket colour, sRGB 0..1 */
  color: [number, number, number];
  /** Read books carry a ribbon marker. */
  read: boolean;
  texUrl?: string;
  bigUrl?: string;
};

/** Where a book rests: centre in page pixels, and its cover width. */
export type Slot = { x: number; y: number; w: number };
/** Where the close-up book is held: centre and size in viewport pixels. */
export type Box = { x: number; y: number; w: number; h: number };

export type Engine = {
  setSlots(slots: (Slot | null)[]): void;
  setHover(index: number | null, tx?: number, ty?: number): void;
  /** The drifting book under a point in the viewport, if any. */
  pick(clientX: number, clientY: number): number | null;
  setSelected(index: number | null): void;
  setBox(box: Box): void;
  drag(dx: number, dy: number): void;
  wake(): void;
  destroy(): void;
};

type Options = {
  canvas: HTMLCanvasElement;
  stage: HTMLElement;
  books: EngineBook[];
  fontFamily: string;
  onLost?: () => void;
};

const OVERSCAN = 0.18;
const LAYER_W = 384;
const LAYER_H = 576;
const COVER_MIPS = 8;
const SPINE_W = 64;
const SPINE_H = 512;
const SPINE_MIPS = 6;
const STRIDE = 32;
const FLOW = 1 / 170;
/** How far a book's landing has to progress before it leaves the stream. */
const CALL = 0.15;
const TAU = Math.PI * 2;

type Quat = [number, number, number, number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const fract = (v: number) => v - Math.floor(v);
const smooth = (t: number) => t * t * (3 - 2 * t);
const smoothstep = (a: number, b: number, v: number) => smooth(clamp((v - a) / (b - a), 0, 1));
const rand = (i: number, k: number) => fract(Math.sin(i * 127.1 + k * 311.7 + 4.1) * 43758.5453);
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** Frame-rate independent ease toward a target. */
const ease = (current: number, target: number, rate: number, dt: number) =>
  target + (current - target) * Math.exp(-rate * dt);

function euler(rx: number, ry: number, rz: number): Quat {
  const cx = Math.cos(rx / 2), sx = Math.sin(rx / 2);
  const cy = Math.cos(ry / 2), sy = Math.sin(ry / 2);
  const cz = Math.cos(rz / 2), sz = Math.sin(rz / 2);
  // yaw · pitch · roll
  return [
    cy * sx * cz + sy * cx * sz,
    sy * cx * cz - cy * sx * sz,
    cy * cx * sz - sy * sx * cz,
    cy * cx * cz + sy * sx * sz,
  ];
}

function multiply(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function nlerp(a: Quat, b: Quat, t: number): Quat {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = dot < 0 ? -1 : 1;
  const x = mix(a[0], b[0] * s, t);
  const y = mix(a[1], b[1] * s, t);
  const z = mix(a[2], b[2] * s, t);
  const w = mix(a[3], b[3] * s, t);
  const n = Math.hypot(x, y, z, w) || 1;
  return [x / n, y / n, z / n, w / n];
}

/** The four boxes of a hardback, with every vertex expressed relative to the
 *  book's outer size so one mesh serves every format and thickness. */
function buildBook() {
  type Edge = [sign: number, board: number, inset: number];
  type Range = [Edge, Edge];
  const vertices: number[] = [];
  const indices: number[] = [];

  // faceMask bit (axis * 2 + side) enables each face; skip hidden internal
  // faces that would be coplanar with the boards or spine.
  const box = (part: number, faceMask: number, ...ranges: [Range, Range, Range]) => {
    for (let axis = 0; axis < 3; axis++) {
      for (let side = 0; side < 2; side++) {
        if (!(faceMask & (1 << (axis * 2 + side)))) continue;
        const base = vertices.length / 13;
        const u = (axis + 1) % 3;
        const v = (axis + 2) % 3;
        for (let corner = 0; corner < 4; corner++) {
          const edges: Edge[] = [];
          edges[axis] = ranges[axis][side];
          edges[u] = ranges[u][corner & 1];
          edges[v] = ranges[v][corner >> 1];
          const normal = [0, 0, 0];
          normal[axis] = side ? 1 : -1;
          vertices.push(
            edges[0][0], edges[1][0], edges[2][0],
            edges[0][1], edges[1][1], edges[2][1],
            edges[0][2], edges[1][2], edges[2][2],
            ...normal,
            part,
          );
        }
        // Consistent outward CCW winding so hardware backface culling works cleanly.
        if (side) {
          indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        } else {
          indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
        }
      }
    }
  };

  const ALL = 0b111111;
  const full: Range = [[-1, 0, 0], [1, 0, 0]];
  const between: Range = [[-1, 1, 0], [1, -1, 0]];
  box(0, ALL, full, full, [[1, -1, 0], [1, 0, 0]]); // front board
  box(1, ALL, full, full, [[-1, 0, 0], [-1, 1, 0]]); // back board
  // Spine: omit +x (glued to pages) and ±z (glued to boards).
  box(2, 0b001101, [[-1, 0, 0], [-1, 1, 0]], full, between);
  // Pages: omit -x (glued to spine) and ±z (glued to boards).
  box(3, 0b001110, [[-1, 1, 0], [1, 0, -1]], [[-1, 0, 1], [1, 0, -1]], between);
  // A ribbon marker, tucked into the pages and hanging out below (omit +y inside pages).
  box(4, 0b110111, [[0.2, 0, 0], [0.34, 0, 0]], [[-1.09, 0, 0], [-0.6, 0, 0]], [[0, -0.2, 0], [0, 0.2, 0]]);

  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

/** A smooth path through the hero, sampled evenly by distance with C1 tangents. */
function buildStream(width: number, height: number) {
  const narrow = width < 760;
  const raw: [number, number][] = narrow
    ? [[-3.4, 0.4], [-2.2, 0.38], [-1.1, 0.33], [-0.2, 0.22], [0.3, 0.15], [0.72, 0.22], [0.87, 0.46], [0.78, 0.74], [0.62, 1.0], [0.5, 1.3]]
    : [[-0.62, 0.52], [-0.3, 0.44], [-0.06, 0.32], [0.2, 0.24], [0.5, 0.25], [0.75, 0.35], [0.89, 0.6], [0.86, 0.92], [0.74, 1.32]];
  const points = raw.map(([x, y]) => [x * width, y * height]);
  const at = (i: number) => points[clamp(i, 0, points.length - 1)];
  const samples: [number, number, number, number][] = [];
  const segments = points.length - 1;
  const steps = 512;
  for (let s = 0; s <= steps; s++) {
    const f = (s / steps) * segments;
    const i = Math.min(Math.floor(f), segments - 1);
    const t = f - i;
    const t2 = t * t;
    const t3 = t2 * t;
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const x =
      0.5 *
      (2 * p1[0] +
        (p2[0] - p0[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3);
    const y =
      0.5 *
      (2 * p1[1] +
        (p2[1] - p0[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3);
    // Exact analytical Catmull-Rom derivative keeps the bank normal C1 smooth.
    const dx =
      0.5 *
      (p2[0] -
        p0[0] +
        2 * (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t +
        3 * (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t2);
    const dy =
      0.5 *
      (p2[1] -
        p0[1] +
        2 * (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t +
        3 * (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t2);
    const dl = Math.hypot(dx, dy) || 1;
    samples.push([x, y, dx / dl, dy / dl]);
  }
  const lengths = [0];
  for (let s = 1; s < samples.length; s++) {
    lengths.push(
      lengths[s - 1] +
        Math.hypot(samples[s][0] - samples[s - 1][0], samples[s][1] - samples[s - 1][1]),
    );
  }
  const total = lengths[steps];
  const even = new Float32Array((steps + 1) * 4);
  let cursor = 0;
  for (let s = 0; s <= steps; s++) {
    const want = (s / steps) * total;
    while (cursor < steps - 1 && lengths[cursor + 1] < want) cursor++;
    const span = lengths[cursor + 1] - lengths[cursor] || 1;
    const t = (want - lengths[cursor]) / span;
    const a = samples[cursor];
    const b = samples[cursor + 1];
    const tx = mix(a[2], b[2], t);
    const ty = mix(a[3], b[3], t);
    const tl = Math.hypot(tx, ty) || 1;
    const o = s * 4;
    even[o] = mix(a[0], b[0], t);
    even[o + 1] = mix(a[1], b[1], t);
    even[o + 2] = tx / tl;
    even[o + 3] = ty / tl;
  }
  return (u: number) => {
    const f = clamp(u, 0, 1) * steps;
    const i = Math.min(Math.floor(f), steps - 1);
    const t = f - i;
    const o = i * 4;
    const tx = mix(even[o + 2], even[o + 6], t);
    const ty = mix(even[o + 3], even[o + 7], t);
    const length = Math.hypot(tx, ty) || 1;
    return {
      x: mix(even[o], even[o + 4], t),
      y: mix(even[o + 1], even[o + 5], t),
      tx: tx / length,
      ty: ty / length,
    };
  };
}

export async function createEngine(options: Options): Promise<Engine | null> {
  const { canvas, stage, books: defs } = options;
  if (!("gpu" in navigator)) return null;
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) return null;

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });

  let destroyed = false;
  device.lost.then(() => {
    if (!destroyed) options.onLost?.();
  });

  const count = defs.length;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  // ── GPU resources ────────────────────────────────────────────────────────
  const mesh = buildBook();
  const vertexBuffer = device.createBuffer({
    size: mesh.vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, mesh.vertices);
  const indexBuffer = device.createBuffer({
    size: mesh.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, mesh.indices);

  const globals = new Float32Array(32);
  const globalBuffer = device.createBuffer({
    size: globals.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const instances = new Float32Array(count * STRIDE);
  const gpuInstances = new Float32Array(count * STRIDE);
  const opaqueOrder: number[] = [];
  const translucentOrder: number[] = [];
  const instanceBuffer = device.createBuffer({
    size: instances.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const textureUsage =
    GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT;
  const covers = device.createTexture({
    size: [LAYER_W, LAYER_H, Math.max(2, count)],
    format: "rgba8unorm-srgb",
    mipLevelCount: COVER_MIPS,
    usage: textureUsage,
  });
  const spines = device.createTexture({
    size: [SPINE_W, SPINE_H, Math.max(2, count)],
    format: "rgba8unorm-srgb",
    mipLevelCount: SPINE_MIPS,
    usage: textureUsage,
  });
  let closeup = device.createTexture({
    size: [1, 1],
    format: "rgba8unorm-srgb",
    usage: textureUsage,
  });
  let closeupFor = -1;
  let closeupToken = 0;

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    maxAnisotropy: 8,
  });

  const both = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: both, buffer: { type: "uniform" } },
      { binding: 1, visibility: both, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "2d-array" } },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "2d-array" } },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "2d" } },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  const makeBindGroup = () =>
    device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: globalBuffer } },
        { binding: 1, resource: { buffer: instanceBuffer } },
        { binding: 2, resource: sampler },
        { binding: 3, resource: covers.createView({ dimension: "2d-array" }) },
        { binding: 4, resource: spines.createView({ dimension: "2d-array" }) },
        { binding: 5, resource: closeup.createView() },
      ],
    });
  let bindGroup = makeBindGroup();

  const mipSampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });
  const mipLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "2d" } },
    ],
  });
  const mipModule = device.createShaderModule({ code: MIP_WGSL });

  const blend: GPUBlendState = {
    color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
  };
  const samples = 4;
  const shadowModule = device.createShaderModule({ code: SHADOW_WGSL });
  const bookModule = device.createShaderModule({ code: BOOK_WGSL });
  const bookVertex: GPUVertexState = {
    module: bookModule,
    entryPoint: "vs",
    buffers: [
      {
        arrayStride: 13 * 4,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 12, format: "float32x3" },
          { shaderLocation: 2, offset: 24, format: "float32x3" },
          { shaderLocation: 3, offset: 36, format: "float32x3" },
          { shaderLocation: 4, offset: 48, format: "float32" },
        ],
      },
    ],
  };
  const [shadowPipeline, bookPipeline, depthPrimePipeline, bookTranslucentPipeline, mipPipeline] =
    await Promise.all([
      device.createRenderPipelineAsync({
        layout: pipelineLayout,
        vertex: { module: shadowModule, entryPoint: "vs" },
        fragment: { module: shadowModule, entryPoint: "fs", targets: [{ format, blend }] },
        primitive: { topology: "triangle-list" },
        depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "always" },
        multisample: { count: samples },
      }),
      device.createRenderPipelineAsync({
        layout: pipelineLayout,
        vertex: bookVertex,
        fragment: { module: bookModule, entryPoint: "fs", targets: [{ format, blend }] },
        primitive: { topology: "triangle-list", cullMode: "back" },
        depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
        multisample: { count: samples },
      }),
      // Per-book depth prime for translucent books: writes only the nearest
      // frontmost surface of that book so its own faces never double-blend.
      device.createRenderPipelineAsync({
        layout: pipelineLayout,
        vertex: bookVertex,
        fragment: {
          module: bookModule,
          entryPoint: "fsDepth",
          targets: [{ format, writeMask: 0 }],
        },
        primitive: { topology: "triangle-list", cullMode: "back" },
        depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
        multisample: { count: samples },
      }),
      device.createRenderPipelineAsync({
        layout: pipelineLayout,
        vertex: bookVertex,
        fragment: { module: bookModule, entryPoint: "fs", targets: [{ format, blend }] },
        primitive: { topology: "triangle-list", cullMode: "back" },
        depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "less-equal" },
        multisample: { count: samples },
      }),
      device.createRenderPipelineAsync({
        layout: device.createPipelineLayout({ bindGroupLayouts: [mipLayout] }),
        vertex: { module: mipModule, entryPoint: "vs" },
        fragment: { module: mipModule, entryPoint: "fs", targets: [{ format: "rgba8unorm-srgb" }] },
        primitive: { topology: "triangle-list" },
      }),
    ]);

  // ── Per-book state ───────────────────────────────────────────────────────
  const state = defs.map((def, i) => ({
    def,
    r: Array.from({ length: 10 }, (_, k) => rand(i, k)),
    // Spread evenly along the stream, shuffled so shelf-mates aren't neighbours.
    u: fract(i * 0.61803398875),
    slot: null as Slot | null,
    placed: false,
    x: 0,
    y: 0,
    w: 150,
    land: 0,
    present: 0,
    hover: 0,
    hoverTo: 0,
    tx: 0,
    ty: 0,
    txTo: 0,
    tyTo: 0,
    held: 0,
    uHold: null as number | null,
    userYaw: 0,
    yawVelocity: 0,
    pitch: 0,
    cover: 0,
    coverReady: false,
    sharp: 0,
    tint: def.color.map(toLinear) as [number, number, number],
  }));

  // Drifting books are drawn in a fixed front-to-back order (highest fliers
  // in front) so that tilted neighbours never cut through each other.
  const flightOrder = new Array<number>(count);
  state
    .map((book, i) => [book.r[1], i])
    .sort((a, b) => a[0] - b[0])
    .forEach(([, i], rank) => (flightOrder[i] = rank + 1));

  let selected = -1;
  let dim = 0;
  let box: Box = { x: 0, y: 0, w: 300, h: 400 };
  let dragging = 0;
  let lastDragTime = 0;

  // ── Viewport ─────────────────────────────────────────────────────────────
  let dpr = 1;
  let screenDpr = 1;
  let stageW = 1;
  let stageTop = 0;
  let viewH = 1;
  let heroH = 1;
  let canvasH = 1;
  let canvasTop = Number.NaN;
  let maxScroll = 0;
  let camera = 1000;
  let stream = buildStream(1, 1);
  let lastStreamW = 0;
  let lastStreamH = 0;
  let targetW = 1;
  let targetH = 1;
  let needsTarget = true;
  let colorTarget: GPUTexture | null = null;
  let depthTarget: GPUTexture | null = null;
  let colorView: GPUTextureView | null = null;
  let depthView: GPUTextureView | null = null;

  const syncTarget = () => {
    if (!needsTarget && colorTarget && depthTarget) return;
    needsTarget = false;
    const pw = targetW;
    const ph = targetH;
    if (canvas.width !== pw || canvas.height !== ph || !colorTarget) {
      canvas.width = pw;
      canvas.height = ph;
      colorTarget?.destroy();
      depthTarget?.destroy();
      colorTarget = device.createTexture({
        size: [pw, ph],
        format,
        sampleCount: samples,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      depthTarget = device.createTexture({
        size: [pw, ph],
        format: "depth24plus",
        sampleCount: samples,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      colorView = colorTarget.createView();
      depthView = depthTarget.createView();
    }
  };

  const resize = () => {
    const rect = stage.getBoundingClientRect();
    stageW = Math.max(1, stage.clientWidth);
    stageTop = rect.top + window.scrollY;
    viewH = Math.max(1, window.innerHeight);
    // The hero is one small-viewport tall; keep the stream tied to it rather
    // than to a viewport that changes as mobile toolbars come and go.
    const hero = stage.parentElement?.querySelector<HTMLElement>("[data-hero]");
    heroH = hero ? hero.offsetHeight : viewH;
    maxScroll = Math.max(0, document.documentElement.scrollHeight - viewH);
    canvasH = Math.ceil(viewH * (1 + OVERSCAN * 2));
    camera = Math.max(viewH * 1.5, stageW * 0.85);
    if (stageW !== lastStreamW || heroH !== lastStreamH) {
      lastStreamW = stageW;
      lastStreamH = heroH;
      stream = buildStream(stageW, heroH);
    }

    screenDpr = window.devicePixelRatio || 1;
    dpr = Math.min(screenDpr, 2);
    const budget = 10_500_000;
    dpr = Math.min(dpr, Math.sqrt(budget / (stageW * canvasH)));
    const limit = device.limits.maxTextureDimension2D;
    targetW = clamp(Math.round(stageW * dpr), 1, limit);
    targetH = clamp(Math.round(canvasH * dpr), 1, limit);
    canvas.style.width = `${stageW}px`;
    canvas.style.height = `${canvasH}px`;
    if (canvas.width !== targetW || canvas.height !== targetH || !colorTarget) {
      needsTarget = true;
    }
    canvasTop = Number.NaN;
    wake();
  };

  // ── Textures ─────────────────────────────────────────────────────────────
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const generateMips = (texture: GPUTexture, layer: number, mips: number) => {
    if (mips <= 1) return;
    const encoder = device.createCommandEncoder();
    for (let level = 1; level < mips; level++) {
      const srcView = texture.createView({
        dimension: "2d",
        baseMipLevel: level - 1,
        mipLevelCount: 1,
        baseArrayLayer: layer,
        arrayLayerCount: 1,
      });
      const dstView = texture.createView({
        dimension: "2d",
        baseMipLevel: level,
        mipLevelCount: 1,
        baseArrayLayer: layer,
        arrayLayerCount: 1,
      });
      const bg = device.createBindGroup({
        layout: mipLayout,
        entries: [
          { binding: 0, resource: mipSampler },
          { binding: 1, resource: srcView },
        ],
      });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: dstView,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
          },
        ],
      });
      pass.setPipeline(mipPipeline);
      pass.setBindGroup(0, bg);
      pass.draw(3);
      pass.end();
    }
    device.queue.submit([encoder.finish()]);
  };

  const upload = async (
    source: HTMLCanvasElement | HTMLImageElement,
    texture: GPUTexture,
    layer: number,
    width: number,
    height: number,
    mips: number,
  ) => {
    if (source instanceof HTMLCanvasElement && source.width === width && source.height === height) {
      if (destroyed) return;
      device.queue.copyExternalImageToTexture(
        { source },
        { texture, origin: [0, 0, layer], mipLevel: 0 },
        [width, height],
      );
      generateMips(texture, layer, mips);
      return;
    }
    const bitmap = await createImageBitmap(source, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "high",
    });
    if (destroyed) return bitmap.close();
    device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture, origin: [0, 0, layer], mipLevel: 0 },
      [width, height],
    );
    bitmap.close();
    generateMips(texture, layer, mips);
  };

  const loadImage = async (url: string) => {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  };

  const spineCanvas = document.createElement("canvas");
  const clothCanvas = document.createElement("canvas");
  let uploadsThisTick = 0;
  let resetScheduled = false;

  const paceUpload = async () => {
    // Keep texture commits paced so the hero stream never drops a frame on load.
    while (!destroyed && uploadsThisTick >= 2) {
      await nextFrame();
    }
    uploadsThisTick++;
    if (!resetScheduled) {
      resetScheduled = true;
      requestAnimationFrame(() => {
        uploadsThisTick = 0;
        resetScheduled = false;
      });
    }
  };

  const loadCover = async (index: number) => {
    const book = state[index];
    try {
      const source = book.def.texUrl
        ? await loadImage(book.def.texUrl)
        : null;
      if (destroyed) return;
      await paceUpload();
      if (destroyed) return;
      const surface = source ?? drawCloth(book.def, LAYER_W, LAYER_H, options.fontFamily, clothCanvas);
      await upload(surface, covers, index, LAYER_W, LAYER_H, COVER_MIPS);
      book.coverReady = true;
      wake();
    } catch {
      // Leave the book in its plain jacket colour.
    }
  };

  const loadAll = async () => {
    await Promise.race([
      document.fonts.load(`600 24px ${options.fontFamily}`),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
    if (destroyed) return;
    // Draw & upload spines in small per-frame batches instead of blocking one tick.
    for (let i = 0; i < count && !destroyed; i++) {
      const spine = drawSpine(state[i].def, SPINE_W, SPINE_H, options.fontFamily, spineCanvas);
      await upload(spine, spines, i, SPINE_W, SPINE_H, SPINE_MIPS);
      if ((i + 1) % 3 === 0) await nextFrame();
    }
    if (destroyed) return;
    let next = 0;
    const worker = async () => {
      while (next < count && !destroyed) await loadCover(next++);
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  };

  const loadCloseup = async (index: number) => {
    const url = state[index].def.bigUrl;
    const token = ++closeupToken;
    if (!url) return;
    try {
      const image = await loadImage(url);
      if (destroyed || token !== closeupToken) return;
      const width = Math.min(image.naturalWidth, 1024);
      const height = Math.round((width * image.naturalHeight) / image.naturalWidth);
      const mips = Math.min(6, Math.floor(Math.log2(Math.max(width, height))) + 1);
      const texture = device.createTexture({
        size: [width, height],
        format: "rgba8unorm-srgb",
        mipLevelCount: mips,
        usage: textureUsage,
      });
      await upload(image, texture, 0, width, height, mips);
      if (destroyed || token !== closeupToken) return texture.destroy();
      const old = closeup;
      closeup = texture;
      closeupFor = index;
      bindGroup = makeBindGroup();
      for (const book of state) book.sharp = 0;
      // Let any frame already in flight finish with the old texture.
      setTimeout(() => old.destroy(), 250);
      wake();
    } catch {
      // The grid-resolution cover stays.
    }
  };

  // ── Frame ────────────────────────────────────────────────────────────────
  let raf = 0;
  let last = 0;
  let clock = 0;
  let lastScroll = window.scrollY;
  let scrollVel = 0;
  let lean = 0;

  const light = [-0.4, 0.56, 0.727];
  const softbox = [-0.36, 0.52, 0.775];

  function frame(now: number) {
    raf = 0;
    if (destroyed) return;
    syncTarget();
    if (!colorView || !depthView) return;
    const dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
    last = now;
    const still = reduced.matches;
    if (!still) clock += dt;
    let active = false;

    const scroll = window.scrollY - stageTop;
    const vw = stageW;
    const vh = viewH;
    const D = camera;

    const top = Math.round((scroll - OVERSCAN * vh) * screenDpr) / screenDpr;
    if (top !== canvasTop) {
      canvasTop = top;
      canvas.style.transform = `translate3d(0, ${top}px, 0)`;
    }
    const centerY = scroll + vh / 2;

    // Books lean into fast scrolling and settle smoothly (2-stage filter avoids
    // 120Hz/wheel chatter between scroll events).
    const rawSpeed = clamp((scroll - lastScroll) / dt, -3500, 3500);
    lastScroll = scroll;
    scrollVel = ease(scrollVel, still ? 0 : rawSpeed, 14, dt);
    lean = ease(lean, still ? 0 : clamp(scrollVel / 5200, -0.16, 0.16), 9, dt);
    if (Math.abs(lean) > 0.0005 || Math.abs(scrollVel) > 1) active = true;

    dim = ease(dim, selected >= 0 ? 1 : 0, 7, dt);
    if (Math.abs(dim - (selected >= 0 ? 1 : 0)) > 0.002) active = true;

    // Close-up handling: per-book free spin with framerate-independent momentum.
    if (selected >= 0) {
      const sb = state[selected];
      if (!dragging) {
        sb.userYaw += sb.yawVelocity * dt;
        sb.yawVelocity *= Math.exp(-3.2 * dt);
        sb.pitch = ease(sb.pitch, 0, 2.5, dt);
      }
      if (!still) active = true;
    }
    dragging = Math.max(0, dragging - dt);

    const band = clamp(vw * 0.12, 48, 176);
    const airWidth = clamp(vw * 0.05, 46, 76);
    const loft = Math.min(D * 0.15, vw * 0.22);
    const nearEnd = smoothstep(maxScroll - vh * 0.45, maxScroll - 2, scroll);
    const streamInView = scroll < heroH * 1.35 + 240;
    const canvasMinY = centerY - canvasTop - canvasH;
    const canvasMaxY = centerY - canvasTop;

    opaqueOrder.length = 0;
    translucentOrder.length = 0;

    for (let i = 0; i < count; i++) {
      const b = state[i];
      const o = i * STRIDE;
      const isHeld = i === selected;

      // Where it rests.
      if (b.slot) {
        if (!b.placed) {
          b.x = b.slot.x;
          b.y = b.slot.y;
          b.w = b.slot.w;
          b.placed = true;
        } else {
          b.x = ease(b.x, b.slot.x, 9, dt);
          b.y = ease(b.y, b.slot.y, 9, dt);
          b.w = ease(b.w, b.slot.w, 9, dt);
          if (Math.abs(b.x - b.slot.x) + Math.abs(b.y - b.slot.y) > 0.3) active = true;
        }
      }
      const presentTo = b.slot ? 1 : 0;
      b.present = ease(b.present, presentTo, 8, dt);
      if (Math.abs(b.present - presentTo) > 0.003) active = true;

      // How far it has come down out of the stream.
      const fromTop = b.y - scroll;
      let landTo = 1 - smoothstep(vh * 0.8, vh * 1.14, fromTop + b.r[5] * vh * 0.1);
      landTo = Math.max(landTo, nearEnd);
      if (still) landTo = 1;
      b.land = still ? 1 : ease(b.land, landTo, 5.5, dt);
      if (Math.abs(b.land - landTo) > 0.002) active = true;

      b.hover = ease(b.hover, b.hoverTo, 11, dt);
      b.tx = ease(b.tx, b.txTo, 10, dt);
      b.ty = ease(b.ty, b.tyTo, 10, dt);
      if (Math.abs(b.hover - b.hoverTo) + Math.abs(b.tx - b.txTo) + Math.abs(b.ty - b.tyTo) > 0.004)
        active = true;

      const heldTo = isHeld ? 1 : 0;
      b.held = ease(b.held, heldTo, 4.6, dt);
      if (Math.abs(b.held - heldTo) > 0.001) active = true;
      if (b.held <= 0.0005) {
        if (b.uHold !== null) {
          b.u = fract(b.uHold - clock * FLOW);
          b.uHold = null;
        }
        b.userYaw = 0;
        b.yawVelocity = 0;
        b.pitch = 0;
      }

      const coverTo = b.coverReady ? 1 : 0;
      b.cover = ease(b.cover, coverTo, 4, dt);
      const sharpTo = isHeld && closeupFor === i ? 1 : 0;
      b.sharp = ease(b.sharp, sharpTo, 6, dt);
      if (Math.abs(b.cover - coverTo) + Math.abs(b.sharp - sharpTo) > 0.004) active = true;

      const w0 = b.w;
      const h0 = w0 / b.def.aspect;
      const t0 = w0 * b.def.thick;

      // On the shelf: cover flush with the page, the block sunk beneath it.
      const lift = b.hover * 30;
      let px = b.x - vw / 2;
      let py = centerY - b.y;
      let pz = -t0 / 2 + lift;
      let scale = 1 + b.hover * 0.015;
      let rotation = euler(lean * 1.4 - b.ty * b.hover * 0.2, b.tx * b.hover * 0.3, 0);
      let alpha = 1;

      // Not on its shelf yet.
      if (!still && b.land < 0.999) {
        if (b.land < CALL) {
          // Adrift in the stream at the top of the page. Freeze its stream phase
          // while plucked into detail view so it never wraps around mid-flight.
          const u = b.uHold !== null ? b.uHold : fract(b.u + clock * FLOW);
          const at = stream(u);
          const swell = Math.sin(Math.PI * u);
          const side = (b.r[0] * 2 - 1) * band * (0.55 + 0.45 * swell);
          const dive = smoothstep(0.82, 1, u);
          const edge = smoothstep(0, 0.06, u) * (1 - smoothstep(0.9, 0.985, u));
          px = at.x - at.ty * side - vw / 2;
          py = centerY - (at.y + at.tx * side);
          pz =
            26 + (0.2 + 0.8 * b.r[1]) * loft * (0.25 + 0.75 * swell) +
            Math.sin(clock * 0.55 + b.r[2] * TAU) * 9 + b.hover * 20;
          scale = (airWidth / w0) * (0.82 + 0.36 * b.r[6]) * (1 - 0.3 * dive) * (1 + b.hover * 0.08);
          const calm = 1 - b.hover * 0.6;
          rotation = euler(
            ((b.r[3] - 0.5) * 0.5 + Math.sin(clock * 0.31 + b.r[4] * TAU) * 0.2) * calm,
            ((b.r[4] - 0.5) * 0.7 + Math.cos(clock * 0.27 + b.r[3] * TAU) * 0.26) * calm,
            ((b.r[8] - 0.5) * 0.62 + Math.sin(clock * 0.19 + b.r[9] * TAU) * 0.07) * calm,
          );
          alpha = edge * (1 - smoothstep(0, CALL, b.land));
          if (streamInView) active = true;
        } else {
          // Rising into place from just beneath its own slot, with tight horizontal
          // sway and staggered depth so neighbours never clip through each other.
          const t = (b.land - CALL) / (1 - CALL);
          const e = smooth(t);
          const from = euler(-0.52, (b.r[3] - 0.5) * 0.65, (b.r[8] - 0.5) * 0.22);
          px = mix(px + (b.r[7] - 0.5) * 20, px, e);
          py = mix(py - 110 - h0 * 0.25, py, e);
          pz = mix(pz + 70 + b.r[1] * 45, pz, e);
          scale = mix(0.88, scale, e);
          rotation = nlerp(from, rotation, e);
          alpha = smoothstep(0, 0.45, t);
        }
      }

      // Held up close.
      if (b.held > 0.0005) {
        const h = smooth(b.held);
        const z = 150;
        const magnify = D / (D - z);
        const fit = Math.min((box.w * 0.78) / w0, (box.h * 0.84) / h0);
        px = mix(px, (box.x - vw / 2) / magnify, h);
        py = mix(py, (vh / 2 - box.y) / magnify, h);
        // Active held book arcs forward; a departing book arcs gently behind it.
        const arc = isHeld ? 60 : -25;
        pz = mix(pz, z, h) + Math.sin(Math.PI * h) * arc;
        scale = mix(scale, fit / magnify, h);
        const yaw = (0.62 + (still ? 0 : Math.sin(clock * 0.5) * 0.08) + b.userYaw) * h + TAU * h;
        rotation = multiply(euler(b.pitch * h, yaw, 0), nlerp(rotation, [0, 0, 0, 1], h));
      }

      alpha = mix(alpha, 1, smooth(b.held)) * b.present * mix(1 - dim, 1, smooth(b.held));
      // Books leaving the list sink and shrink a touch as they fade.
      scale *= 0.9 + 0.1 * b.present;

      // model = translate · rotate · scale
      const [qx, qy, qz, qw] = rotation;
      const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
      const xx = qx * x2, xy = qx * y2, xz = qx * z2;
      const yy = qy * y2, yz = qy * z2, zz = qz * z2;
      const wx = qw * x2, wy = qw * y2, wz = qw * z2;
      instances[o] = (1 - (yy + zz)) * scale;
      instances[o + 1] = (xy + wz) * scale;
      instances[o + 2] = (xz - wy) * scale;
      instances[o + 3] = 0;
      instances[o + 4] = (xy - wz) * scale;
      instances[o + 5] = (1 - (xx + zz)) * scale;
      instances[o + 6] = (yz + wx) * scale;
      instances[o + 7] = 0;
      instances[o + 8] = (xz + wy) * scale;
      instances[o + 9] = (yz - wx) * scale;
      instances[o + 10] = (1 - (xx + yy)) * scale;
      instances[o + 11] = 0;
      instances[o + 12] = px;
      instances[o + 13] = py;
      instances[o + 14] = pz;
      instances[o + 15] = 1;
      instances[o + 16] = w0;
      instances[o + 17] = h0;
      instances[o + 18] = t0;
      instances[o + 19] = i;
      instances[o + 20] = b.tint[0];
      instances[o + 21] = b.tint[1];
      instances[o + 22] = b.tint[2];
      const outAlpha = alpha < 0.004 ? 0 : alpha;
      instances[o + 23] = outAlpha;
      instances[o + 24] = b.cover;
      instances[o + 25] = b.sharp;
      // Shadows fall on the paper under the shelf; a held book keeps its
      // shadow close so it doesn't land on the text beside it.
      const rise =
        Math.abs(instances[o + 2]) * w0 * 0.5 +
        Math.abs(instances[o + 6]) * h0 * 0.5 +
        Math.abs(instances[o + 10]) * t0 * 0.5;
      instances[o + 26] = mix(-t0, pz - rise - 30, smooth(b.held));
      instances[o + 27] = b.r[9] + (b.def.read ? 2 : 0);
      const adrift = !still && b.land < CALL;
      // Active held book gets the top slab, departing held book one slab below,
      // adrift books keep their stable flightOrder (no hover depth popping).
      instances[o + 28] =
        isHeld && b.held > 0.001
          ? count + 2
          : b.held > 0.001
            ? count + 1
            : adrift
              ? flightOrder[i]
              : 0;
      instances[o + 29] = count + 3;

      if (outAlpha <= 0) continue;
      if (b.held <= 0.001) {
        const proj = D / Math.max(100, D - pz);
        const screenPy = py * proj;
        const margin = Math.max(h0, w0) * scale * proj * 1.4 + 260;
        if (screenPy + margin < canvasMinY || screenPy - margin > canvasMaxY) continue;
      }
      if (outAlpha >= 0.996) opaqueOrder.push(i);
      else translucentOrder.push(i);
    }

    // Draw opaque books front-to-back (early-Z friendly), then translucent books
    // strictly back-to-front so fading books blend cleanly without clipping holes.
    opaqueOrder.sort((a, b) => {
      const oa = a * STRIDE;
      const ob = b * STRIDE;
      const ds = instances[ob + 28] - instances[oa + 28];
      return ds !== 0 ? ds : instances[ob + 14] - instances[oa + 14];
    });
    translucentOrder.sort((a, b) => {
      const oa = a * STRIDE;
      const ob = b * STRIDE;
      const ds = instances[oa + 28] - instances[ob + 28];
      return ds !== 0 ? ds : instances[oa + 14] - instances[ob + 14];
    });

    const opaqueCount = opaqueOrder.length;
    const transCount = translucentOrder.length;
    const visibleCount = opaqueCount + transCount;
    for (let k = 0; k < opaqueCount; k++) {
      const src = opaqueOrder[k] * STRIDE;
      gpuInstances.set(instances.subarray(src, src + STRIDE), k * STRIDE);
    }
    for (let k = 0; k < transCount; k++) {
      const src = translucentOrder[k] * STRIDE;
      gpuInstances.set(instances.subarray(src, src + STRIDE), (opaqueCount + k) * STRIDE);
    }

    // Camera: straight down at the middle of the viewport, with a frustum
    // stretched to cover the whole (taller) canvas.
    const n = D * 0.2;
    const f = D * 2.2;
    const k = n / D;
    const l = (-vw / 2) * k;
    const r = (vw / 2) * k;
    const t = (centerY - canvasTop) * k;
    const bt = (centerY - canvasTop - canvasH) * k;
    const zz = f / (n - f);
    const zw = (n * f) / (n - f);
    globals.fill(0);
    globals[0] = (2 * n) / (r - l);
    globals[5] = (2 * n) / (t - bt);
    globals[8] = (r + l) / (r - l);
    globals[9] = (t + bt) / (t - bt);
    globals[10] = zz;
    globals[11] = -1;
    globals[12] = -D * globals[8];
    globals[13] = -D * globals[9];
    globals[14] = -D * zz + zw;
    globals[15] = D;
    globals[18] = D;
    globals[19] = clock;
    globals.set(light, 20);
    globals[23] = dpr;
    globals.set(softbox, 24);
    globals[27] = 1;
    globals.set([0.085, 0.055, 0.03], 28);

    device.queue.writeBuffer(globalBuffer, 0, globals);
    if (visibleCount > 0) {
      device.queue.writeBuffer(instanceBuffer, 0, gpuInstances, 0, visibleCount * STRIDE);
    }

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: colorView,
          resolveTarget: context!.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "discard",
        },
      ],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "discard",
      },
    });
    pass.setBindGroup(0, bindGroup);
    if (visibleCount > 0) {
      pass.setPipeline(shadowPipeline);
      pass.draw(6, visibleCount);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");
      if (opaqueCount > 0) {
        pass.setPipeline(bookPipeline);
        pass.drawIndexed(mesh.indices.length, opaqueCount, 0, 0, 0);
      }
      for (let m = 0; m < transCount; m++) {
        const inst = opaqueCount + m;
        pass.setPipeline(depthPrimePipeline);
        pass.drawIndexed(mesh.indices.length, 1, 0, 0, inst);
        pass.setPipeline(bookTranslucentPipeline);
        pass.drawIndexed(mesh.indices.length, 1, 0, 0, inst);
      }
    }
    pass.end();
    device.queue.submit([encoder.finish()]);

    if (active) wake();
    else last = 0;
  }

  function wake() {
    if (!raf && !destroyed) raf = requestAnimationFrame(frame);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", wake, { passive: true });
  reduced.addEventListener("change", wake);
  resize();
  void loadAll();

  return {
    setSlots(slots) {
      for (let i = 0; i < count; i++) state[i].slot = slots[i] ?? null;
      maxScroll = Math.max(0, document.documentElement.scrollHeight - viewH);
      wake();
    },
    setHover(index, tx = 0, ty = 0) {
      for (let i = 0; i < count; i++) {
        const on = i === index;
        state[i].hoverTo = on ? 1 : 0;
        if (on) {
          state[i].txTo = tx;
          state[i].tyTo = ty;
        }
      }
      wake();
    },
    pick(clientX, clientY) {
      if (selected >= 0 || reduced.matches) return null;
      const x = clientX - stageW / 2;
      const y = viewH / 2 - clientY;
      let best: number | null = null;
      let nearest = -1;
      for (let i = 0; i < count; i++) {
        const o = i * STRIDE;
        if (state[i].land >= CALL || instances[o + 23] < 0.5) continue;
        const z = instances[o + 28];
        if (z <= nearest) continue;
        // Project the front cover's corners and test the point against them.
        const hw = instances[o + 16] / 2, hh = instances[o + 17] / 2, ht = instances[o + 18] / 2;
        let inside = true;
        let sign = 0;
        let fx = 0, fy = 0, lx = 0, ly = 0;
        for (let c = 0; c <= 4 && inside; c++) {
          const cx = c === 1 || c === 2 ? hw : -hw;
          const cy = c === 2 || c === 3 ? hh : -hh;
          const wx = instances[o] * cx + instances[o + 4] * cy + instances[o + 8] * ht + instances[o + 12];
          const wy = instances[o + 1] * cx + instances[o + 5] * cy + instances[o + 9] * ht + instances[o + 13];
          const wz = instances[o + 2] * cx + instances[o + 6] * cy + instances[o + 10] * ht + instances[o + 14];
          const k = camera / (camera - wz);
          const sx = wx * k, sy = wy * k;
          if (c === 0) {
            fx = sx;
            fy = sy;
          }
          if (c > 0) {
            const ex = (c === 4 ? fx : sx) - lx, ey = (c === 4 ? fy : sy) - ly;
            const side = Math.sign(ex * (y - ly) - ey * (x - lx));
            if (sign === 0) sign = side;
            else if (side !== 0 && side !== sign) inside = false;
          }
          lx = sx;
          ly = sy;
        }
        if (inside) {
          best = i;
          nearest = z;
        }
      }
      return best;
    },
    setSelected(index) {
      const next = index ?? -1;
      if (next === selected) return;
      selected = next;
      dragging = 0;
      lastDragTime = 0;
      if (next >= 0) {
        const b = state[next];
        if (b.held < 0.05) {
          b.userYaw = 0;
          b.pitch = 0;
        }
        b.yawVelocity = 0;
        if (b.land < CALL && b.uHold === null) {
          b.uHold = fract(b.u + clock * FLOW);
        }
        void loadCloseup(next);
      } else {
        closeupToken++;
      }
      wake();
    },
    setBox(next) {
      box = next;
      wake();
    },
    drag(dx, dy) {
      if (selected < 0) return;
      const b = state[selected];
      const now = performance.now();
      const dtDrag = lastDragTime ? clamp((now - lastDragTime) / 1000, 0.004, 0.05) : 1 / 60;
      lastDragTime = now;
      const turn = dx * 0.0095;
      b.userYaw += turn;
      const instVel = clamp(turn / dtDrag, -18, 18);
      b.yawVelocity = mix(b.yawVelocity, instVel, 0.55);
      b.pitch = clamp(b.pitch + dy * 0.006, -0.75, 0.75);
      dragging = 0.08;
      wake();
    },
    wake,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", wake);
      reduced.removeEventListener("change", wake);
      device.destroy();
    },
  };
}
