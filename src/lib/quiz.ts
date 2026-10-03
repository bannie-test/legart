import type { Artwork, L10n, QuizQuestion } from "@/content/types";
import { getPalette } from "./mosaic/palettes";
import { colorCounts, type Mosaic } from "./mosaic/engine";
import { rngFor, shuffle } from "./rng";

export type QuizOption =
  | { kind: "text"; text: L10n }
  | { kind: "color"; hex: string; name: L10n }
  | { kind: "image"; src: string };

export interface QuizItem {
  id: string;
  prompt: L10n;
  options: QuizOption[];
  correct: number;
  explain?: L10n;
}

export const QUIZ_LENGTH = 3;

const L = (en: string, vi: string): L10n => ({ en, vi });

function fromQuestion(q: QuizQuestion, seed: number): QuizItem {
  const order = shuffle(rngFor(seed, `opts:${q.id}`), [0, 1, 2, 3]);
  return {
    id: q.id,
    prompt: q.question,
    options: order.map((i) => ({ kind: "text" as const, text: q.options[i] })),
    correct: order.indexOf(0),
    explain: q.explain,
  };
}

export function questionsQuiz(questions: QuizQuestion[], seed: number, n = QUIZ_LENGTH): QuizItem[] {
  return shuffle(rngFor(seed, "quiz"), questions).slice(0, n).map((q) => fromQuestion(q, seed));
}

export function libraryQuiz(art: Artwork, seed: number): QuizItem[] {
  return questionsQuiz(art.quiz, seed);
}

/**
 * Questions generated from the mosaic itself, for the player's own photos.
 * `pieceImages[i]` is an image URL of piece i (used for the "which piece goes in the corner" question).
 */
export function memoryQuiz(m: Mosaic, seed: number, pieceImages: string[], cols: number, rows: number): QuizItem[] {
  const rng = rngFor(seed, "memory");
  const pal = getPalette(m.paletteId);
  const counts = colorCounts(m);
  const items: QuizItem[] = [];

  // 1. most used colour
  const top = counts[0].index;
  const others = shuffle(rng, pal.colors.map((_, i) => i).filter((i) => i !== top)).slice(0, 3);
  const colorOpts = shuffle(rng, [top, ...others]);
  items.push({
    id: "mem-top-color",
    prompt: L("Which brick colour did your picture use the most?", "Bức tranh của bạn dùng màu gạch nào nhiều nhất?"),
    options: colorOpts.map((i) => ({ kind: "color", hex: pal.colors[i].hex, name: pal.colors[i].name })),
    correct: colorOpts.indexOf(top),
    explain: L(
      `${pal.colors[top].name.en}: ${counts[0].count} studs out of ${m.indices.length}.`,
      `${pal.colors[top].name.vi}: ${counts[0].count} trên tổng ${m.indices.length} nút.`,
    ),
  });

  // 2. which piece belongs top-left
  const n = rows * cols;
  if (pieceImages.length === n && n >= 4) {
    const decoys = shuffle(rng, Array.from({ length: n - 1 }, (_, i) => i + 1)).slice(0, 3);
    const opts = shuffle(rng, [0, ...decoys]);
    items.push({
      id: "mem-corner",
      prompt: L("Which piece belongs in the top-left corner?", "Mảnh nào nằm ở góc trên bên trái?"),
      options: opts.map((i) => ({ kind: "image", src: pieceImages[i] })),
      correct: opts.indexOf(0),
    });
  }

  // 3. number of colours
  const used = counts.length;
  const candidates = new Set<number>([used]);
  for (const d of shuffle(rng, [-6, -4, -2, 2, 4, 6, 8])) {
    if (candidates.size >= 4) break;
    if (used + d >= 1) candidates.add(used + d);
  }
  const nums = [...candidates].sort((a, b) => a - b);
  items.push({
    id: "mem-colors",
    prompt: L("How many different brick colours are in your picture?", "Bức tranh của bạn có bao nhiêu màu gạch khác nhau?"),
    options: nums.map((v) => ({ kind: "text", text: L(String(v), String(v)) })),
    correct: nums.indexOf(used),
  });
  return items;
}
