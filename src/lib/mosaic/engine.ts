import { linearToSrgb, rgbToHex, rgbToLab, srgbToLinear, deltaE76, type Lab, type RGB } from "./color";
import { AUTO_PALETTE_ID, preparePalette, type PreparedPalette } from "./palettes";
import { mulberry32 } from "../rng";

export interface MosaicOptions {
  /** Studs horizontally / vertically. */
  width: number;
  height: number;
  /** a fixed palette id, or "auto" to pick colours from the picture */
  paletteId: string;
  /** number of colours for the "auto" palette */
  colorCount?: number;
  dithering: boolean;
  /** -1..1, 0 = unchanged. */
  brightness?: number;
  contrast?: number;
  saturation?: number;
}

export interface Mosaic {
  width: number;
  height: number;
  paletteId: string;
  /** Palette index per stud, row-major. */
  indices: Uint8Array;
  /** hex colours of an "auto" palette (fixed palettes are looked up by id) */
  colors?: string[];
}

export interface RawImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/** Averages the source pixels covered by each stud, in linear RGB so dark areas don't get muddy. */
export function downsample(img: RawImage, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h * 3);
  for (let sy = 0; sy < h; sy++) {
    const y0 = Math.floor((sy * img.height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((sy + 1) * img.height) / h));
    for (let sx = 0; sx < w; sx++) {
      const x0 = Math.floor((sx * img.width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((sx + 1) * img.width) / w));
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        let p = (y * img.width + x0) * 4;
        for (let x = x0; x < x1; x++, p += 4) {
          const a = img.data[p + 3] / 255;
          // Transparent pixels are composited on white.
          r += srgbToLinear(img.data[p]) * a + (1 - a);
          g += srgbToLinear(img.data[p + 1]) * a + (1 - a);
          b += srgbToLinear(img.data[p + 2]) * a + (1 - a);
          n++;
        }
      }
      const o = (sy * w + sx) * 3;
      out[o] = linearToSrgb(r / n);
      out[o + 1] = linearToSrgb(g / n);
      out[o + 2] = linearToSrgb(b / n);
    }
  }
  return out;
}

/** Brightness/contrast/saturation tweak on sRGB values in place. */
export function adjust(rgb: Float32Array, brightness = 0, contrast = 0, saturation = 0): void {
  if (!brightness && !contrast && !saturation) return;
  const cf = Math.tan(((contrast + 1) * Math.PI) / 4); // 0 -> 1, 1 -> inf, -1 -> 0
  const sf = 1 + saturation;
  for (let i = 0; i < rgb.length; i += 3) {
    let r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = lum + (r - lum) * sf;
    g = lum + (g - lum) * sf;
    b = lum + (b - lum) * sf;
    r = (r - 128) * cf + 128 + brightness * 128;
    g = (g - 128) * cf + 128 + brightness * 128;
    b = (b - 128) * cf + 128 + brightness * 128;
    rgb[i] = Math.max(0, Math.min(255, r));
    rgb[i + 1] = Math.max(0, Math.min(255, g));
    rgb[i + 2] = Math.max(0, Math.min(255, b));
  }
}

export function nearest(lab: Lab, pal: PreparedPalette): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pal.lab.length; i++) {
    const d = deltaE76(lab, pal.lab[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function quantize(rgb: Float32Array, w: number, h: number, pal: PreparedPalette, dithering: boolean): Uint8Array {
  const n = w * h;
  const lab = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const l = rgbToLab([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]] as RGB);
    lab[i * 3] = l[0];
    lab[i * 3 + 1] = l[1];
    lab[i * 3 + 2] = l[2];
  }
  const out = new Uint8Array(n);
  const strength = 0.75; // full-strength diffusion looks noisy at stud resolution
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const cur: Lab = [lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]];
      const idx = nearest(cur, pal);
      out[i] = idx;
      if (!dithering) continue;
      const p = pal.lab[idx];
      const e = [(cur[0] - p[0]) * strength, (cur[1] - p[1]) * strength, (cur[2] - p[2]) * strength];
      const spread = (dx: number, dy: number, f: number) => {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= w || ny >= h) return;
        const j = (ny * w + nx) * 3;
        lab[j] += e[0] * f;
        lab[j + 1] += e[1] * f;
        lab[j + 2] += e[2] * f;
      };
      spread(1, 0, 7 / 16);
      spread(-1, 1, 3 / 16);
      spread(0, 1, 5 / 16);
      spread(1, 1, 1 / 16);
    }
  }
  return out;
}

/**
 * Picks `k` representative colours from the picture with k-means in CIELAB (k-means++ seeding,
 * deterministic). Gives far more faithful pixel art than a fixed palette.
 */
export function adaptivePalette(rgb: Float32Array, k: number): RGB[] {
  const n = rgb.length / 3;
  const lab: Lab[] = [];
  for (let i = 0; i < n; i++) lab.push(rgbToLab([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]));
  k = Math.max(2, Math.min(k, n));
  const rng = mulberry32(n * 31 + k);
  const centers: Lab[] = [lab[Math.floor(rng() * n)]];
  const dist = new Float64Array(n).fill(Infinity);
  while (centers.length < k) {
    let total = 0;
    const last = centers[centers.length - 1];
    for (let i = 0; i < n; i++) {
      dist[i] = Math.min(dist[i], deltaE76(lab[i], last));
      total += dist[i];
    }
    if (total === 0) break;
    let r = rng() * total;
    let pick = n - 1;
    for (let i = 0; i < n; i++) if ((r -= dist[i]) <= 0) { pick = i; break; }
    centers.push(lab[pick]);
  }
  const assign = new Int32Array(n);
  for (let iter = 0; iter < 12; iter++) {
    const sum = centers.map(() => [0, 0, 0, 0]);
    const rsum = centers.map(() => [0, 0, 0]);
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = deltaE76(lab[i], centers[c]);
        if (d < bd) { bd = d; best = c; }
      }
      assign[i] = best;
      const sm = sum[best];
      sm[0] += lab[i][0]; sm[1] += lab[i][1]; sm[2] += lab[i][2]; sm[3]++;
      rsum[best][0] += rgb[i * 3]; rsum[best][1] += rgb[i * 3 + 1]; rsum[best][2] += rgb[i * 3 + 2];
    }
    for (let c = 0; c < centers.length; c++) if (sum[c][3]) centers[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
    if (iter === 11) {
      return centers
        .map((_, c) => (sum[c][3] ? ([rsum[c][0] / sum[c][3], rsum[c][1] / sum[c][3], rsum[c][2] / sum[c][3]] as RGB) : null))
        .filter((x): x is RGB => x !== null);
    }
  }
  return [];
}

export function generateMosaic(img: RawImage, opts: MosaicOptions): Mosaic {
  const rgb = downsample(img, opts.width, opts.height);
  adjust(rgb, opts.brightness, opts.contrast, opts.saturation);
  if (opts.paletteId === AUTO_PALETTE_ID) {
    const colors = adaptivePalette(rgb, opts.colorCount ?? 32).map((c) => rgbToHex(c));
    const pal: PreparedPalette = {
      palette: { id: AUTO_PALETTE_ID, name: { en: "Auto", vi: "Tự động" }, colors: [] },
      rgb: [],
      lab: colors.map((h) => rgbToLab([parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)])),
    };
    const indices = quantize(rgb, opts.width, opts.height, pal, opts.dithering);
    return { width: opts.width, height: opts.height, paletteId: AUTO_PALETTE_ID, indices, colors };
  }
  const pal = preparePalette(opts.paletteId);
  const indices = quantize(rgb, opts.width, opts.height, pal, opts.dithering);
  return { width: opts.width, height: opts.height, paletteId: pal.palette.id, indices };
}

/** Hex colour list for a mosaic, whether it uses a fixed or an auto palette. */
export function mosaicColors(m: Pick<Mosaic, "paletteId" | "colors">, fixed: (id: string) => { hex: string }[]): string[] {
  return m.colors ?? fixed(m.paletteId).map((c) => c.hex);
}

/** How many studs of each palette colour the mosaic uses, most used first. */
export function colorCounts(m: Mosaic): { index: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const i of m.indices) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts.entries()].map(([index, count]) => ({ index, count })).sort((a, b) => b.count - a.count);
}
