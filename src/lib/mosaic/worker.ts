/// <reference lib="webworker" />
import { generateMosaic, type MosaicOptions } from "./engine";

export interface MosaicRequest {
  id: number;
  bitmap: ImageBitmap;
  /** Source rectangle in bitmap pixels. */
  crop: { x: number; y: number; w: number; h: number };
  opts: MosaicOptions;
}

self.onmessage = (e: MessageEvent<MosaicRequest>) => {
  const { id, bitmap, crop, opts } = e.data;
  try {
    // ~6 samples per stud is plenty for the area average and keeps this fast.
    const sw = Math.min(crop.w, opts.width * 6);
    const sh = Math.min(crop.h, opts.height * 6);
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(sw)), Math.max(1, Math.round(sh)));
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const mosaic = generateMosaic({ data: img.data, width: img.width, height: img.height }, opts);
    (self as unknown as Worker).postMessage({ id, mosaic }, [mosaic.indices.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
