/// <reference types="@webgpu/types" />

import { WATER_COMPUTE_WGSL, WATER_RENDER_WGSL } from "./water-shaders";

const GRID_W = 256;
const GRID_H = 160;
const HORIZON_IMG_V = 0.452;

export type WaterEngine = {
  disturb(clientX: number, clientY: number, strength: number, radius?: number): void;
  setActive(active: boolean): void;
  destroy(): void;
};

function coverUV(
  u: number,
  v: number,
  canvasW: number,
  canvasH: number,
  imgW: number,
  imgH: number
): [number, number] {
  const canvasAspect = canvasW / Math.max(canvasH, 1);
  const imgAspect = imgW / Math.max(imgH, 1);
  let scaleX = 1;
  let scaleY = 1;
  if (canvasAspect > imgAspect) {
    scaleY = imgAspect / canvasAspect;
  } else {
    scaleX = canvasAspect / imgAspect;
  }
  return [(u - 0.5) * scaleX + 0.5, (v - 0.5) * scaleY + 0.5];
}

export async function createWaterEngine(
  canvas: HTMLCanvasElement,
  imageUrl: string,
  onReady?: () => void
): Promise<WaterEngine | null> {
  if (typeof navigator === "undefined" || !("gpu" in navigator) || !navigator.gpu) {
    return null;
  }

  let adapter: GPUAdapter | null = null;
  let device: GPUDevice | null = null;
  try {
    adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return null;
    device = await adapter.requestDevice();
  } catch {
    return null;
  }

  const context = canvas.getContext("webgpu");
  if (!context) {
    device.destroy();
    return null;
  }

  let bitmap: ImageBitmap;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error("Failed to load hero image");
    const blob = await res.blob();
    bitmap = await createImageBitmap(blob);
  } catch {
    device.destroy();
    return null;
  }

  const imgW = bitmap.width;
  const imgH = bitmap.height;
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: "opaque",
  });

  // Upload hero photograph to GPU texture
  const photoTex = device.createTexture({
    size: [imgW, imgH, 1],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture: photoTex },
    [imgW, imgH]
  );
  bitmap.close();

  const photoSampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });

  // 3 ping-pong heightfield buffers for 2D Verlet wave integration
  const cellCount = GRID_W * GRID_H;
  const bufferBytes = cellCount * Float32Array.BYTES_PER_ELEMENT;
  const heightBuffers: GPUBuffer[] = [0, 1, 2].map(() =>
    device.createBuffer({
      size: bufferBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
  );

  // Uniform buffers
  const simUniformBuffer = device.createBuffer({
    size: 48, // 3 x vec4<f32>
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const renderUniformBuffer = device.createBuffer({
    size: 32, // 2 x vec4<f32>
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Pipelines with strict validation scope so the canvas never masks the photo on GPU error
  device.pushErrorScope("validation");
  const computeModule = device.createShaderModule({ code: WATER_COMPUTE_WGSL });
  const renderModule = device.createShaderModule({ code: WATER_RENDER_WGSL });

  const [computeInfo, renderInfo] = await Promise.all([
    computeModule.getCompilationInfo(),
    renderModule.getCompilationInfo(),
  ]);
  const hasCompileError = [...computeInfo.messages, ...renderInfo.messages].some(
    (m) => m.type === "error"
  );

  const computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: computeModule,
      entryPoint: "stepWater",
    },
  });

  const renderPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: renderModule,
      entryPoint: "vsMain",
    },
    fragment: {
      module: renderModule,
      entryPoint: "fsMain",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  const validationError = await device.popErrorScope();
  if (hasCompileError || validationError) {
    photoTex.destroy();
    simUniformBuffer.destroy();
    renderUniformBuffer.destroy();
    for (const buf of heightBuffers) buf.destroy();
    device.destroy();
    return null;
  }

  // Pre-create bind groups for the 3 ring states (prev, curr, next)
  const computeBindGroups = [0, 1, 2].map((state) => {
    const prevIdx = state;
    const currIdx = (state + 1) % 3;
    const nextIdx = (state + 2) % 3;
    return device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: simUniformBuffer } },
        { binding: 1, resource: { buffer: heightBuffers[prevIdx] } },
        { binding: 2, resource: { buffer: heightBuffers[currIdx] } },
        { binding: 3, resource: { buffer: heightBuffers[nextIdx] } },
      ],
    });
  });

  const renderBindGroups = [0, 1, 2].map((bufIdx) =>
    device.createBindGroup({
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: renderUniformBuffer } },
        { binding: 1, resource: photoSampler },
        { binding: 2, resource: photoTex.createView() },
        { binding: 3, resource: { buffer: heightBuffers[bufIdx] } },
      ],
    })
  );

  let destroyed = false;
  let active = true;
  let rafId = 0;
  let ringState = 0;
  let notifiedReady = false;
  let canvasW = 1;
  let canvasH = 1;

  // Pending impulses
  const pointerImpulse = { u: 0.5, v: 0.5, strength: 0, radius: 0.032 };
  const simData = new Float32Array(12);
  const renderData = new Float32Array(8);

  const syncSize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextW = Math.max(1, Math.round(rect.width * dpr));
    const nextH = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    canvasW = nextW;
    canvasH = nextH;
  };

  syncSize();
  const resizeObserver = new ResizeObserver(syncSize);
  resizeObserver.observe(canvas);

  const startTime = performance.now();
  let nextAmbientAt = startTime + 900;

  const frame = (now: number) => {
    if (destroyed) return;
    if (!active || document.hidden) {
      rafId = 0;
      return;
    }

    const elapsedSec = (now - startTime) * 0.001;

    // Gentle, occasional natural droplet on the pond surface
    let ambU = 0.5;
    let ambV = 0.5;
    let ambStrength = 0;
    let ambRadius = 0.024;
    if (now >= nextAmbientAt) {
      ambU = 0.16 + Math.random() * 0.68;
      ambV = 0.14 + Math.random() * 0.62;
      ambStrength = 0.24 + Math.random() * 0.18;
      ambRadius = 0.018 + Math.random() * 0.014;
      nextAmbientAt = now + 2200 + Math.random() * 2400;
    }

    // Write compute uniforms
    simData[0] = GRID_W;
    simData[1] = GRID_H;
    simData[2] = 0.986; // viscous damping
    simData[3] = 0.19; // wave speed squared (stable CFL)

    simData[4] = pointerImpulse.u;
    simData[5] = pointerImpulse.v;
    simData[6] = pointerImpulse.strength;
    simData[7] = pointerImpulse.radius;

    simData[8] = ambU;
    simData[9] = ambV;
    simData[10] = ambStrength;
    simData[11] = ambRadius;

    // Consume pointer impulse after injecting
    pointerImpulse.strength = 0;

    device.queue.writeBuffer(simUniformBuffer, 0, simData);

    // Write render uniforms
    renderData[0] = canvasW;
    renderData[1] = canvasH;
    renderData[2] = imgW;
    renderData[3] = imgH;
    renderData[4] = GRID_W;
    renderData[5] = GRID_H;
    renderData[6] = elapsedSec;
    renderData[7] = HORIZON_IMG_V;
    device.queue.writeBuffer(renderUniformBuffer, 0, renderData);

    const encoder = device.createCommandEncoder();

    // Compute pass: advance wave PDE
    const cPass = encoder.beginComputePass();
    cPass.setPipeline(computePipeline);
    cPass.setBindGroup(0, computeBindGroups[ringState]);
    cPass.dispatchWorkgroups(Math.ceil(GRID_W / 16), Math.ceil(GRID_H / 16));
    cPass.end();

    const newestBufIdx = (ringState + 2) % 3;
    ringState = (ringState + 1) % 3;

    // Render pass: optical water refraction + twilight reflection
    const view = context.getCurrentTexture().createView();
    const rPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0.047, g: 0.102, b: 0.122, a: 1.0 },
        },
      ],
    });
    rPass.setPipeline(renderPipeline);
    rPass.setBindGroup(0, renderBindGroups[newestBufIdx]);
    rPass.draw(3);
    rPass.end();

    device.queue.submit([encoder.finish()]);

    if (!notifiedReady) {
      notifiedReady = true;
      onReady?.();
    }

    rafId = requestAnimationFrame(frame);
  };

  const resume = () => {
    if (!destroyed && active && !document.hidden && rafId === 0) {
      rafId = requestAnimationFrame(frame);
    }
  };

  const onVisibilityChange = () => {
    if (!document.hidden) resume();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  device.lost.then(() => {
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
  });

  // Seed one gentle opening ripple so the pond breathes immediately
  pointerImpulse.u = 0.62;
  pointerImpulse.v = 0.34;
  pointerImpulse.strength = 0.42;
  pointerImpulse.radius = 0.028;

  resume();

  return {
    disturb(clientX: number, clientY: number, strength: number, radius = 0.028) {
      if (destroyed) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const u = (clientX - rect.left) / rect.width;
      const v = (clientY - rect.top) / rect.height;
      if (u < 0 || u > 1 || v < 0 || v > 1) return;

      const [, imgV] = coverUV(u, v, rect.width, rect.height, imgW, imgH);
      if (imgV <= HORIZON_IMG_V + 0.01) return;

      const wy = Math.min(1, Math.max(0, (imgV - HORIZON_IMG_V) / (1 - HORIZON_IMG_V)));
      const simV = Math.pow(wy, 0.72);

      pointerImpulse.u = u;
      pointerImpulse.v = simV;
      pointerImpulse.strength = strength;
      pointerImpulse.radius = radius;
    },
    setActive(nextActive: boolean) {
      active = nextActive;
      if (active) {
        resume();
      } else if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      photoTex.destroy();
      simUniformBuffer.destroy();
      renderUniformBuffer.destroy();
      for (const buf of heightBuffers) buf.destroy();
      device.destroy();
    },
  };
}
