import { describe, expect, it } from "vitest";
import { computeGrid, studsPerPiece } from "./grid";
import { initGame, reduceGame, replay } from "./game";
import { rulesFor } from "./modes";
import { generateEdges, piecePathD } from "./jigsaw";
import type { LogEntry, Mode, PuzzleSpec, Shape } from "./types";
import type { SquareState } from "./square";
import type { JigsawState } from "./jigsaw";

/** Plays a perfect game, returning the log. */
function solve(spec: PuzzleSpec): LogEntry[] {
  const rules = rulesFor(spec.mode, spec.shape);
  let state = initGame(spec);
  const log: LogEntry[] = [];
  let t = 0;
  const act = (a: LogEntry["a"]) => {
    t += 1000;
    log.push({ t, a });
    state = reduceGame(state, a, rules);
  };
  const n = spec.rows * spec.cols;
  for (let i = 0; i < n; i++) {
    if (state.kind === "square") {
      const s = state as SquareState;
      while (s.rot[i] !== 0 && (state as SquareState).rot[i] !== 0) act({ type: "rotate", piece: i });
      act({ type: "drop", piece: i, to: i });
    } else {
      while ((state as JigsawState).pieces[i].rot !== 0) act({ type: "rotate", piece: i });
      const x = (i % spec.cols) + 0.1;
      const y = Math.floor(i / spec.cols) - 0.1;
      act({ type: "drop", piece: i, x, y });
    }
  }
  return log;
}

describe("grid", () => {
  it("defaults to 6x6 for 36 square pieces", () => {
    expect(computeGrid(1, 36)).toEqual({ rows: 6, cols: 6 });
    expect(studsPerPiece(6, 6, 48)).toBe(8);
  });
  it("keeps pieces squarish for wide images", () => {
    const g = computeGrid(16 / 9, 36);
    expect(g.cols).toBeGreaterThan(g.rows);
    expect(Math.abs(g.rows * g.cols - 36)).toBeLessThanOrEqual(4);
  });
});

describe("deterministic setup", () => {
  it("same seed gives the same shuffle", () => {
    const spec: PuzzleSpec = { rows: 6, cols: 6, shape: "square", mode: "hard", seed: 42 };
    expect(initGame(spec)).toEqual(initGame(spec));
    expect(initGame({ ...spec, seed: 43 })).not.toEqual(initGame(spec));
  });
  it("easy mode lists edge pieces first and never rotates", () => {
    const s = initGame({ rows: 6, cols: 6, shape: "square", mode: "easy", seed: 1 }) as SquareState;
    expect(s.rot.every((r) => r === 0)).toBe(true);
    const edges = 20; // 6x6 border
    const firstInterior = s.tray.findIndex((i) => i % 6 > 0 && i % 6 < 5 && i > 5 && i < 30);
    expect(firstInterior).toBe(edges);
  });
});

const combos: [Shape, Mode][] = [
  ["square", "easy"], ["square", "hard"], ["square", "expert"],
  ["jigsaw", "easy"], ["jigsaw", "hard"], ["jigsaw", "expert"],
];

describe.each(combos)("%s / %s", (shape, mode) => {
  const spec: PuzzleSpec = { rows: 4, cols: 5, shape, mode, seed: 1234 };
  it("a perfect game replays as solved", () => {
    const log = solve(spec);
    const r = replay(spec, log);
    expect(r.reason).toBeUndefined();
    expect(r.ok).toBe(true);
  });
  it("an unfinished game is rejected", () => {
    const log = solve(spec).slice(0, -1);
    expect(replay(spec, log).ok).toBe(false);
  });
  it("an impossibly fast game is rejected", () => {
    const log = solve(spec).map((e, i) => ({ ...e, t: i }));
    expect(replay(spec, log).reason).toBe("too-fast");
  });
});

describe("square rules", () => {
  it("swaps pieces between cells and locks correct ones", () => {
    const spec: PuzzleSpec = { rows: 2, cols: 2, shape: "square", mode: "easy", seed: 5 };
    const rules = rulesFor("easy", "square");
    let s = initGame(spec) as SquareState;
    s = reduceGame(s, { type: "drop", piece: 0, to: 1 }, rules) as SquareState;
    s = reduceGame(s, { type: "drop", piece: 1, to: 0 }, rules) as SquareState;
    expect(s.cells.slice(0, 2)).toEqual([1, 0]);
    s = reduceGame(s, { type: "drop", piece: 0, to: 0 }, rules) as SquareState;
    expect(s.cells.slice(0, 2)).toEqual([0, 1]);
    expect(s.locked[0]).toBe(true);
    expect(s.locked[1]).toBe(true);
    const same = reduceGame(s, { type: "drop", piece: 0, to: 3 }, rules);
    expect(same).toBe(s);
  });
});

describe("jigsaw rules", () => {
  it("joins neighbours into a group that moves together (expert, no board snap)", () => {
    const spec: PuzzleSpec = { rows: 2, cols: 2, shape: "jigsaw", mode: "expert", seed: 9 };
    const rules = rulesFor("expert", "jigsaw");
    let s = initGame(spec) as JigsawState;
    for (const i of [0, 1]) while (s.pieces[i].rot !== 0) s = reduceGame(s, { type: "rotate", piece: i }, rules) as JigsawState;
    s = reduceGame(s, { type: "drop", piece: 0, x: 0.4, y: 0.6 }, rules) as JigsawState;
    s = reduceGame(s, { type: "drop", piece: 1, x: 1.5, y: 0.5 }, rules) as JigsawState;
    expect(s.pieces[0].group).toBe(s.pieces[1].group);
    expect(s.pieces[1].x - s.pieces[0].x).toBeCloseTo(1);
    s = reduceGame(s, { type: "drop", piece: 0, x: -0.6, y: 0.5 }, rules) as JigsawState;
    expect(s.pieces[1].x).toBeCloseTo(0.4);
    expect(s.pieces[0].locked).toBe(false);
  });

  it("produces closed SVG paths with tabs that match between neighbours", () => {
    const edges = generateEdges(3, 3, 77);
    const d = piecePathD(edges, 4, 100);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    // centre piece of 3x3 has 4 tabbed edges: 4 curves each
    expect(d.split("C").length - 1).toBe(16);
    const corner = piecePathD(edges, 0, 100);
    expect(corner.split("C").length - 1).toBe(4 + 4 + 1 + 1);
  });
});
