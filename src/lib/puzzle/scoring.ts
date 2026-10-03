import { rulesFor, SHAPE_MULTIPLIER } from "./modes";
import type { Mode, Shape } from "./types";

export const QUIZ_SECONDS = 15;

export function puzzleScore(totalMs: number, mode: Mode, shape: Shape, pieces: number): number {
  const base = Math.max(0, 10000 - (totalMs / 1000) * 10);
  return Math.round(base * rulesFor(mode, shape).multiplier * SHAPE_MULTIPLIER[shape] * (pieces / 36));
}

export function quizScore(answers: { correct: boolean; ms: number }[]): number {
  return Math.round(
    answers.reduce((sum, a) => sum + (a.correct ? 500 + Math.max(0, 200 * (1 - a.ms / (QUIZ_SECONDS * 1000))) : 0), 0),
  );
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${m}:${s.toString().padStart(2, "0")}.${tenths}`;
}
