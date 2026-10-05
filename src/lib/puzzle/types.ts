export type Shape = "square" | "jigsaw";
export type Mode = "easy" | "hard" | "expert";
export type PreviewPolicy = "always" | "hold" | "off";

export const SHAPES: Shape[] = ["square", "jigsaw"];
export const MODES: Mode[] = ["easy", "hard", "expert"];
export const PIECE_OPTIONS = [9, 16, 36, 64, 100, 144] as const;
export const DEFAULT_PIECES = 36;
export const DETAIL_OPTIONS = [32, 48, 64, 96, 128] as const;
export const DEFAULT_DETAIL = 48;

export interface PuzzleSpec {
  rows: number;
  cols: number;
  shape: Shape;
  mode: Mode;
  seed: number;
}

export type SquareAction =
  | { type: "drop"; piece: number; to: number | "tray" }
  | { type: "rotate"; piece: number };

export type JigsawAction =
  | { type: "drop"; piece: number; x: number; y: number }
  | { type: "rotate"; piece: number }
  | { type: "tray"; piece: number };

/** Log-only markers: they don't change the board but carry time penalties. */
export type MarkerAction = { type: "hint" } | { type: "peek" };

export type Action = SquareAction | JigsawAction | MarkerAction;

export interface LogEntry {
  /** ms since the game clock started */
  t: number;
  a: Action;
}
