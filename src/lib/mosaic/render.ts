import { getPalette } from "./palettes";
import type { Mosaic } from "./engine";

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** One pre-drawn stud per palette colour; the mosaic is then just many drawImage calls. */
function studSprite(hex: string, s: number): AnyCanvas {
  const c = makeCanvas(s, s);
  const ctx = c.getContext("2d") as Ctx;
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, s, s);
  // brick seams
  ctx.fillStyle = shade(hex, -0.12);
  ctx.fillRect(0, s - Math.max(1, s * 0.04), s, Math.max(1, s * 0.04));
  ctx.fillRect(s - Math.max(1, s * 0.04), 0, Math.max(1, s * 0.04), s);
  const cx = s / 2, cy = s / 2, r = s * 0.34;
  // shadow
  ctx.beginPath();
  ctx.arc(cx + s * 0.04, cy + s * 0.05, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fill();
  // stud
  const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, shade(hex, 0.22));
  g.addColorStop(0.7, hex);
  g.addColorStop(1, shade(hex, -0.1));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(0.5, s * 0.03);
  ctx.strokeStyle = shade(hex, -0.18);
  ctx.stroke();
  return c;
}

/** Hex colour per palette index (auto palettes carry their own colours). */
export function colorsOf(m: Pick<Mosaic, "paletteId" | "colors">): string[] {
  return m.colors ?? getPalette(m.paletteId).colors.map((c) => c.hex);
}

export function renderMosaic(m: Mosaic, studPx: number): AnyCanvas {
  const colors = colorsOf(m);
  const canvas = makeCanvas(m.width * studPx, m.height * studPx);
  const ctx = canvas.getContext("2d") as Ctx;
  const sprites = new Map<number, AnyCanvas>();
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const idx = m.indices[y * m.width + x];
      let sp = sprites.get(idx);
      if (!sp) {
        sp = studSprite(colors[idx] ?? "#888888", studPx);
        sprites.set(idx, sp);
      }
      ctx.drawImage(sp as CanvasImageSource, x * studPx, y * studPx);
    }
  }
  return canvas;
}

/** Flat version (one pixel per stud), handy for thumbnails. */
export function renderFlat(m: Mosaic): AnyCanvas {
  const colors = colorsOf(m);
  const canvas = makeCanvas(m.width, m.height);
  const ctx = canvas.getContext("2d") as Ctx;
  const img = ctx.createImageData(m.width, m.height);
  for (let i = 0; i < m.indices.length; i++) {
    const n = parseInt((colors[m.indices[i]] ?? "#888888").slice(1), 16);
    img.data[i * 4] = (n >> 16) & 255;
    img.data[i * 4 + 1] = (n >> 8) & 255;
    img.data[i * 4 + 2] = n & 255;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Crisp pixel art: every cell becomes a `px` × `px` square (nearest-neighbour scaling). */
export function renderPixel(m: Mosaic, px: number): AnyCanvas {
  const flat = renderFlat(m);
  const canvas = makeCanvas(m.width * px, m.height * px);
  const ctx = canvas.getContext("2d") as Ctx;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(flat as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return canvas;
}
