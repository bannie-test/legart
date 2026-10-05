"use client";
import { JIGSAW_PAD, generateEdges, piecePathD, type JigsawEdges } from "@/lib/puzzle/jigsaw";
import type { Shape } from "@/lib/puzzle/types";

export interface PieceArt {
  /** object URLs, one per piece */
  urls: string[];
  /** px of one piece cell */
  size: number;
  /** px of the image box (size for square, size * (1 + 2*PAD) for jigsaw) */
  box: number;
  /** SVG path per piece in box coordinates (jigsaw only) */
  paths: string[];
  edges: JigsawEdges | null;
}

/** Pressed-cardboard look: light inner edge on the top-left, dark on the bottom-right, thin cut line. */
function emboss(ctx: CanvasRenderingContext2D, path: Path2D, size: number) {
  const lw = Math.max(2, size * 0.035);
  const d = lw * 0.4;
  ctx.save();
  ctx.clip(path);
  ctx.lineWidth = lw;
  ctx.translate(d, d);
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.stroke(path);
  ctx.translate(-2 * d, -2 * d);
  ctx.strokeStyle = "rgba(0,0,0,0.38)";
  ctx.stroke(path);
  ctx.restore();
  ctx.lineWidth = Math.max(1, size * 0.008);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke(path);
}

const toUrl = (c: HTMLCanvasElement) =>
  new Promise<string>((res, rej) => c.toBlob((b) => (b ? res(URL.createObjectURL(b)) : rej(new Error("toBlob"))), "image/png"));

/** Cuts the puzzle picture into piece images. */
export async function buildPieces(mosaic: HTMLCanvasElement, rows: number, cols: number, shape: Shape, seed: number): Promise<PieceArt> {
  const size = Math.floor(mosaic.width / cols);
  const n = rows * cols;
  const urls: string[] = [];
  const paths: string[] = [];
  if (shape === "square") {
    for (let i = 0; i < n; i++) {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(mosaic, (i % cols) * size, Math.floor(i / cols) * size, size, size, 0, 0, size, size);
      const rect = new Path2D();
      rect.rect(0, 0, size, size);
      emboss(ctx, rect, size);
      urls.push(await toUrl(c));
    }
    return { urls, size, box: size, paths, edges: null };
  }
  const edges = generateEdges(rows, cols, seed);
  const box = Math.round(size * (1 + 2 * JIGSAW_PAD));
  for (let i = 0; i < n; i++) {
    const c = document.createElement("canvas");
    c.width = c.height = box;
    const ctx = c.getContext("2d")!;
    const d = piecePathD(edges, i, size);
    paths.push(d);
    const path = new Path2D(d);
    ctx.save();
    ctx.clip(path);
    ctx.drawImage(mosaic, -((i % cols) - JIGSAW_PAD) * size, -(Math.floor(i / cols) - JIGSAW_PAD) * size);
    ctx.restore();
    emboss(ctx, path, size);
    urls.push(await toUrl(c));
  }
  return { urls, size, box, paths, edges };
}

export function revokePieces(art: PieceArt | null) {
  art?.urls.forEach((u) => URL.revokeObjectURL(u));
}
