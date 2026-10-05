import "server-only";
import { MODES, SHAPES, type Mode, type PreviewPolicy, type Shape } from "../puzzle/types";
import type { L10n, QuizQuestion } from "@/content/types";

export const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
export const isShape = (v: unknown): v is Shape => SHAPES.includes(v as Shape);
export const isMode = (v: unknown): v is Mode => MODES.includes(v as Mode);
export const isPreview = (v: unknown): v is PreviewPolicy => v === "always" || v === "hold" || v === "off";

export function cleanText(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, max) : "";
}

export function cleanL10n(v: unknown, max = 120): L10n {
  const o = (v ?? {}) as Record<string, unknown>;
  const en = cleanText(o.en, max);
  const vi = cleanText(o.vi, max) || en;
  return { en: en || vi, vi };
}

export function cleanQuestions(v: unknown): QuizQuestion[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 3).flatMap((q, i) => {
    const question = cleanL10n(q?.question, 140);
    const options = Array.isArray(q?.options) ? q.options.slice(0, 4).map((o: unknown) => cleanL10n(o, 60)) : [];
    if (!question.en || options.length !== 4 || options.some((o: L10n) => !o.en)) return [];
    return [{ id: `custom-${i + 1}`, question, options: options as QuizQuestion["options"], explain: cleanL10n(q?.explain, 200) }];
  });
}

export const MAX_GRID = 20;
export const MAX_PIECES = 200;
