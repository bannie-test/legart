import type { Artwork, L10n, QuizQuestion } from "@/content/types";
import { getPalette } from "./mosaic/palettes";
import { colorCounts, type Mosaic } from "./mosaic/engine";
import { colorsOf } from "./mosaic/render";
import { rngFor, shuffle } from "./rng";

export type QuizOption =
  | { kind: "text"; text: L10n }
  | { kind: "color"; hex: string; name?: L10n }
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
 * Questions generated from the player's own picture.
 * `m` is a colour-quantised version of it (the puzzle mosaic, or a small auto-palette one for photo puzzles);
 * `pieceImages[i]` is an image URL of piece i, used for the corner questions.
 */
export function memoryQuiz(m: Mosaic, seed: number, pieceImages: string[], cols: number, rows: number, photo = false): QuizItem[] {
  const rng = rngFor(seed, "memory");
  const fixed = m.colors ? null : getPalette(m.paletteId);
  const hexes = colorsOf(m);
  const counts = colorCounts(m);
  const items: QuizItem[] = [];
  const nameOf = (i: number): L10n => fixed?.colors[i]?.name ?? L(hexes[i], hexes[i]);

  // 1. dominant colour — distractors come from colours the picture barely uses (or doesn't use at all)
  const top = counts[0].index;
  const used = new Set(counts.slice(0, Math.max(2, Math.ceil(counts.length / 3))).map((c) => c.index));
  let pool = hexes.map((_, i) => i).filter((i) => !used.has(i));
  if (pool.length < 3) pool = hexes.map((_, i) => i).filter((i) => i !== top);
  const colorOpts = shuffle(rng, [top, ...shuffle(rng, pool).slice(0, 3)]);
  const pct = Math.round((counts[0].count / m.indices.length) * 100);
  items.push({
    id: "mem-top-color",
    prompt: L("Which colour covers the most of your picture?", "Màu nào chiếm nhiều nhất trong bức tranh của bạn?"),
    options: colorOpts.map((i) => ({ kind: "color", hex: hexes[i], name: fixed ? nameOf(i) : undefined })),
    correct: colorOpts.indexOf(top),
    explain: L(`About ${pct}% of the picture.`, `Khoảng ${pct}% bức tranh.`),
  });

  // 2. corner pieces
  const n = rows * cols;
  const corner = (id: string, piece: number, prompt: L10n) => {
    if (pieceImages.length !== n || n < 4) return;
    const decoys = shuffle(rng, Array.from({ length: n }, (_, i) => i).filter((i) => i !== piece)).slice(0, 3);
    const opts = shuffle(rng, [piece, ...decoys]);
    items.push({ id, prompt, options: opts.map((i) => ({ kind: "image", src: pieceImages[i] })), correct: opts.indexOf(piece) });
  };
  corner("mem-corner", 0, L("Which piece belongs in the top-left corner?", "Mảnh nào nằm ở góc trên bên trái?"));
  if (photo) {
    corner("mem-corner-br", n - 1, L("Which piece belongs in the bottom-right corner?", "Mảnh nào nằm ở góc dưới bên phải?"));
    return items;
  }

  // 3. number of colours (pixel / brick styles)
  const usedCount = counts.length;
  const candidates = new Set<number>([usedCount]);
  for (const d of shuffle(rng, [-6, -4, -2, 2, 4, 6, 8])) {
    if (candidates.size >= 4) break;
    if (usedCount + d >= 1) candidates.add(usedCount + d);
  }
  const nums = [...candidates].sort((a, b) => a - b);
  items.push({
    id: "mem-colors",
    prompt: L("How many different colours are in your picture?", "Bức tranh của bạn có bao nhiêu màu khác nhau?"),
    options: nums.map((v) => ({ kind: "text", text: L(String(v), String(v)) })),
    correct: nums.indexOf(usedCount),
  });
  return items;
}
