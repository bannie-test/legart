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

const toUrl = (c: HTMLCanvasElement) =>
  new Promise<string>((res, rej) => c.toBlob((b) => (b ? res(URL.createObjectURL(b)) : rej(new Error("toBlob"))), "image/png"));

/** Cuts the rendered mosaic into piece images. */
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
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, size - 2, size - 2);
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
    ctx.lineWidth = Math.max(1.5, size * 0.02);
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.stroke(path);
    ctx.save();
    ctx.translate(-1, -1);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke(path);
    ctx.restore();
    urls.push(await toUrl(c));
  }
  return { urls, size, box, paths, edges };
}

export function revokePieces(art: PieceArt | null) {
  art?.urls.forEach((u) => URL.revokeObjectURL(u));
}
