"use client";
import { generateMosaic, type Mosaic, type MosaicOptions } from "./engine";

export interface Crop { x: number; y: number; w: number; h: number }

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (m: Mosaic) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data.mosaic);
    };
  }
  return worker;
}

/** Largest crop with the given aspect ratio (width / height), centred on the focus point (0..1). */
export function focusCrop(srcW: number, srcH: number, aspect: number, fx = 0.5, fy = 0.5): Crop {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  if (srcW / srcH > aspect) {
    const w = srcH * aspect;
    return { x: clamp(fx * srcW - w / 2, srcW - w), y: 0, w, h: srcH };
  }
  const h = srcW / aspect;
  return { x: 0, y: clamp(fy * srcH - h / 2, srcH - h), w: srcW, h };
}

/** Builds the mosaic in a Web Worker (falls back to the main thread). */
export async function buildMosaic(bitmap: ImageBitmap, crop: Crop, opts: MosaicOptions): Promise<Mosaic> {
  const w = getWorker();
  if (w) {
    // The worker needs its own copy: transferring would detach the caller's bitmap.
    const copy = await createImageBitmap(bitmap);
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      w.postMessage({ id, bitmap: copy, crop, opts }, [copy]);
    });
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(Math.min(crop.w, opts.width * 6));
  canvas.height = Math.round(Math.min(crop.h, opts.height * 6));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return generateMosaic({ data: img.data, width: img.width, height: img.height }, opts);
}

export async function loadBitmap(src: string | Blob): Promise<ImageBitmap> {
  if (typeof src !== "string") return createImageBitmap(src, { imageOrientation: "from-image" });
  const res = await fetch(src);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${src}`);
  return createImageBitmap(await res.blob(), { imageOrientation: "from-image" });
}
