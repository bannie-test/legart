import type { Mode, PreviewPolicy, Shape } from "./types";

export interface ModeRules {
  rotation: boolean;
  /** faint picture under the board */
  ghost: boolean;
  grid: "full" | "frame" | "none";
  /** correct pieces lock in place (square) / snap to the board (jigsaw) */
  lock: boolean;
  /** locked pieces get a visible ✓ outline */
  lockFeedback: boolean;
  edgesFirst: boolean;
  previewOptions: PreviewPolicy[];
  peekPenaltyMs: number;
  /** -1 = unlimited */
  maxPeeks: number;
  /** 0 = held as long as the finger stays down */
  peekDurationMs: number;
  /** -1 = unlimited */
  hintLimit: number;
  hintPenaltyMs: number;
  multiplier: number;
}

export function rulesFor(mode: Mode, shape: Shape): ModeRules {
  switch (mode) {
    case "easy":
      return {
        rotation: false, ghost: true, grid: "full", lock: true, lockFeedback: true, edgesFirst: true,
        previewOptions: ["always", "hold", "off"], peekPenaltyMs: 0, maxPeeks: -1, peekDurationMs: 0,
        hintLimit: -1, hintPenaltyMs: 3000, multiplier: 1,
      };
    case "hard":
      return {
        rotation: true, ghost: false, grid: shape === "square" ? "full" : "frame", lock: true, lockFeedback: false,
        edgesFirst: false, previewOptions: ["hold", "off"], peekPenaltyMs: 5000, maxPeeks: -1, peekDurationMs: 0,
        hintLimit: 3, hintPenaltyMs: 10000, multiplier: 2,
      };
    case "expert":
      return {
        rotation: true, ghost: false, grid: "none", lock: false, lockFeedback: false, edgesFirst: false,
        previewOptions: ["off", "hold"], peekPenaltyMs: 15000, maxPeeks: 1, peekDurationMs: 3000,
        hintLimit: 0, hintPenaltyMs: 0, multiplier: 3,
      };
  }
}

export const SHAPE_MULTIPLIER: Record<Shape, number> = { square: 1, jigsaw: 1.2 };
