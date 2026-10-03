import type { Mode, PreviewPolicy, Shape } from "./puzzle/types";
import type { L10n } from "@/content/types";
import type { QuizQuestion } from "@/content/types";

export type Source =
  | { kind: "library"; id: string }
  | { kind: "local"; id: string }
  | { kind: "cloud"; id: string }
  | { kind: "challenge"; code: string };

export interface StoredMosaic {
  width: number;
  height: number;
  paletteId: string;
  /** base64 of the palette-index bytes */
  indices: string;
}

export interface GameConfig {
  source: Source;
  title: L10n;
  aspect: string;
  pieces: number;
  rows: number;
  cols: number;
  shape: Shape;
  mode: Mode;
  preview: PreviewPolicy;
  detail: number;
  paletteId: string;
  dithering: boolean;
  /** -1..1 */
  brightness: number;
  contrast: number;
  saturation: number;
  /** 0..1 focus point of the crop (user images) */
  focusX: number;
  focusY: number;
  /** filled when playing a challenge */
  challenge?: { code: string; seed: number; mosaic: StoredMosaic; imageUrl: string | null; artworkId: string | null; questions: QuizQuestion[] };
}

const KEY = "legart:config";

export function saveConfig(c: GameConfig) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* private mode */
  }
}

export function loadConfig(): GameConfig | null {
  try {
    const s = sessionStorage.getItem(KEY);
    return s ? (JSON.parse(s) as GameConfig) : null;
  } catch {
    return null;
  }
}

export function configKey(c: GameConfig): string {
  const src = c.source.kind === "challenge" ? `c:${c.source.code}` : `${c.source.kind}:${c.source.id}`;
  return [src, c.rows, c.cols, c.shape, c.mode, c.preview, c.detail, c.paletteId, c.dithering ? 1 : 0].join("|");
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
