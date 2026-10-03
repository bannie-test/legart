import { randInt, rngFor, shuffle } from "../rng";
import { isEdgePiece } from "./grid";
import type { ModeRules } from "./modes";
import type { PuzzleSpec, SquareAction } from "./types";

/** Square tiles: the board is a grid of cells, piece i belongs in cell i at rotation 0. */
export interface SquareState {
  kind: "square";
  rows: number;
  cols: number;
  cells: (number | null)[];
  tray: number[];
  /** quarter turns clockwise */
  rot: number[];
  locked: boolean[];
  moves: number;
  solved: boolean;
}

export function initSquare(spec: PuzzleSpec, rules: ModeRules): SquareState {
  const n = spec.rows * spec.cols;
  const ids = Array.from({ length: n }, (_, i) => i);
  let tray = shuffle(rngFor(spec.seed, "order"), ids);
  if (rules.edgesFirst) {
    tray = [...tray.filter((i) => isEdgePiece(i, spec.rows, spec.cols)), ...tray.filter((i) => !isEdgePiece(i, spec.rows, spec.cols))];
  }
  const rotRng = rngFor(spec.seed, "rot");
  const rot = ids.map(() => (rules.rotation ? randInt(rotRng, 0, 3) : 0));
  return {
    kind: "square",
    rows: spec.rows,
    cols: spec.cols,
    cells: Array(n).fill(null),
    tray,
    rot,
    locked: Array(n).fill(false),
    moves: 0,
    solved: false,
  };
}

function check(s: SquareState, rules: ModeRules, cell: number) {
  const p = s.cells[cell];
  if (rules.lock && p === cell && s.rot[p] === 0) s.locked[p] = true;
}

function isSolved(s: SquareState): boolean {
  return s.cells.every((p, i) => p === i && s.rot[i] === 0);
}

/** Pure reducer shared by the client and the server-side replay. Returns the same object when the action is a no-op. */
export function reduceSquare(prev: SquareState, action: SquareAction, rules: ModeRules): SquareState {
  if (prev.solved) return prev;
  const n = prev.cells.length;
  if (!Number.isInteger(action.piece) || action.piece < 0 || action.piece >= n) return prev;
  if (prev.locked[action.piece]) return prev;
  const s: SquareState = { ...prev, cells: prev.cells.slice(), tray: prev.tray.slice(), rot: prev.rot.slice(), locked: prev.locked.slice() };
  const piece = action.piece;
  const fromCell = s.cells.indexOf(piece);
  const trayPos = s.tray.indexOf(piece);

  if (action.type === "rotate") {
    if (!rules.rotation) return prev;
    s.rot[piece] = (s.rot[piece] + 1) % 4;
    if (fromCell >= 0) check(s, rules, fromCell);
  } else if (action.to === "tray") {
    if (fromCell < 0) return prev;
    s.cells[fromCell] = null;
    s.tray.unshift(piece);
  } else {
    const to = action.to;
    if (!Number.isInteger(to) || to < 0 || to >= n || to === fromCell) return prev;
    const occupant = s.cells[to];
    if (occupant !== null && s.locked[occupant]) return prev;
    s.cells[to] = piece;
    if (fromCell >= 0) {
      s.cells[fromCell] = occupant;
      if (occupant !== null) check(s, rules, fromCell);
    } else {
      s.tray.splice(trayPos, 1);
      if (occupant !== null) s.tray.splice(trayPos, 0, occupant);
    }
    check(s, rules, to);
  }
  s.moves++;
  s.solved = isSolved(s);
  if (s.solved) s.locked = s.locked.map(() => true);
  return s;
}

export function squareFull(s: SquareState): boolean {
  return s.cells.every((p) => p !== null);
}
