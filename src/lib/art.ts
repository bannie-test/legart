"use client";
import type { ArtStyle } from "./game-config";
import { buildMosaic, focusCrop, type Crop } from "./mosaic/client";
import type { Mosaic } from "./mosaic/engine";
import { AUTO_PALETTE_ID } from "./mosaic/palettes";
import { renderMosaic, renderPixel } from "./mosaic/render";
import { studsPerPiece } from "./puzzle/grid";

export interface ArtOptions {
  style: ArtStyle;
  rows: number;
  cols: number;
  detail: number;
  paletteId: string;
  colorCount: number;
  dithering: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  focusX: number;
  focusY: number;
}

export interface Art {
  /** the full picture the pieces are cut from; width = cols * piece size */
  canvas: HTMLCanvasElement;
  /** quantised version (pixel/brick styles), null for photos */
  mosaic: Mosaic | null;
}

/** Target size of one piece in pixels: sharp on high-DPI phones without huge canvases. */
const PIECE_PX = 160;
const MAX_SIDE = 2400;

export function pieceSizeFor(rows: number, cols: number): number {
  return Math.max(48, Math.min(PIECE_PX, Math.floor(MAX_SIDE / Math.max(rows, cols))));
}

/** Crop to the grid's own ratio so pieces are square and nothing is stretched. */
export function cropFor(bitmap: ImageBitmap, o: Pick<ArtOptions, "rows" | "cols" | "focusX" | "focusY">): Crop {
  return focusCrop(bitmap.width, bitmap.height, o.cols / o.rows, o.focusX, o.focusY);
}

function photoCanvas(bitmap: ImageBitmap, crop: Crop, w: number, h: number, o: ArtOptions): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const f: string[] = [];
  if (o.brightness) f.push(`brightness(${1 + o.brightness})`);
  if (o.contrast) f.push(`contrast(${1 + o.contrast})`);
  if (o.saturation) f.push(`saturate(${1 + o.saturation})`);
  if (f.length) ctx.filter = f.join(" ");
  ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
  return c;
}

/**
 * Draws the puzzle picture in the chosen style.
 * `given` lets a challenge reuse the creator's exact mosaic.
 */
export async function buildArt(bitmap: ImageBitmap, o: ArtOptions, given?: Mosaic | null, pieceTarget = PIECE_PX): Promise<Art> {
  const crop = cropFor(bitmap, o);
  if (o.style === "photo") {
    const p = Math.min(pieceTarget, pieceSizeFor(o.rows, o.cols));
    return { canvas: photoCanvas(bitmap, crop, o.cols * p, o.rows * p, o), mosaic: null };
  }
  const k = studsPerPiece(o.rows, o.cols, o.detail);
  const mosaic =
    given ??
    (await buildMosaic(bitmap, crop, {
      width: o.cols * k, height: o.rows * k,
      paletteId: o.style === "pixel" ? o.paletteId : o.paletteId === AUTO_PALETTE_ID ? "classic" : o.paletteId,
      colorCount: o.colorCount, dithering: o.dithering,
      brightness: o.brightness, contrast: o.contrast, saturation: o.saturation,
    }));
  const unit = Math.max(2, Math.round(Math.min(pieceTarget, pieceSizeFor(o.rows, o.cols)) / (mosaic.width / o.cols)));
  const canvas = (o.style === "pixel" ? renderPixel(mosaic, unit) : renderMosaic(mosaic, unit)) as HTMLCanvasElement;
  return { canvas, mosaic };
}

/** Small colour-quantised copy of a photo, used by the memory quiz. */
export async function quizMosaic(bitmap: ImageBitmap, o: ArtOptions): Promise<Mosaic> {
  return buildMosaic(bitmap, cropFor(bitmap, o), {
    width: 32, height: Math.max(4, Math.round((32 * o.rows) / o.cols)), paletteId: AUTO_PALETTE_ID, colorCount: 12, dithering: false,
  });
}

export function ghostUrl(art: Art): string {
  if (art.mosaic) return (renderPixel(art.mosaic, Math.max(1, Math.round(480 / art.mosaic.width))) as HTMLCanvasElement).toDataURL();
  return art.canvas.toDataURL("image/jpeg", 0.7);
}
