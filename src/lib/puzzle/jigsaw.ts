import { randInt, rngFor, shuffle } from "../rng";
import { isEdgePiece } from "./grid";
import type { ModeRules } from "./modes";
import type { JigsawAction, PuzzleSpec } from "./types";

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** Space around each piece's cell (in piece units) that tabs can reach into. */
export const JIGSAW_PAD = 0.3;

interface EdgeParams {
  /** +1 bulges towards +y (horizontal edge) / +x (vertical edge) */
  sign: 1 | -1;
  shift: number;
  height: number;
}

export interface JigsawEdges {
  rows: number;
  cols: number;
  /** h[r][c]: edge at y = r between rows r-1 and r (r = 1..rows-1) */
  h: EdgeParams[][];
  /** v[r][c]: edge at x = c between cols c-1 and c (c = 1..cols-1) */
  v: EdgeParams[][];
}

type Pt = [number, number];
/** cubic segment: control 1, control 2, end */
type Seg = [Pt, Pt, Pt];

// Classic tab profile for an edge from u=0 to u=1, v = bulge (positive = outward).
const TAB: [number, number][][] = [
  [[0.36, 0], [0.44, 0.03], [0.42, 0.09]],
  [[0.38, 0.18], [0.42, 0.25], [0.5, 0.25]],
  [[0.58, 0.25], [0.62, 0.18], [0.58, 0.09]],
  [[0.56, 0.03], [0.64, 0], [1, 0]],
];

export function generateEdges(rows: number, cols: number, seed: number): JigsawEdges {
  const rng = rngFor(seed, "edges");
  const make = (): EdgeParams => ({
    sign: rng() < 0.5 ? 1 : -1,
    shift: (rng() - 0.5) * 0.12,
    height: 0.9 + rng() * 0.2,
  });
  const h: EdgeParams[][] = [];
  const v: EdgeParams[][] = [];
  for (let r = 0; r < rows; r++) {
    h.push([]);
    v.push([]);
    for (let c = 0; c < cols; c++) {
      h[r].push(make());
      v[r].push(make());
    }
  }
  return { rows, cols, h, v };
}

function edgeSegs(e: EdgeParams | null, horizontal: boolean, X: number, Y: number): Seg[] {
  const map = (u: number, w: number): Pt => {
    const uu = u === 1 ? 1 : u + (e?.shift ?? 0);
    const ww = e ? w * e.height * e.sign : 0;
    return horizontal ? [X + uu, Y + ww] : [X + ww, Y + uu];
  };
  if (!e) return [[map(1 / 3, 0), map(2 / 3, 0), map(1, 0)]];
  return TAB.map((seg) => seg.map(([u, w]) => map(u, w)) as Seg);
}

function reverseSegs(start: Pt, segs: Seg[]): Seg[] {
  const out: Seg[] = [];
  for (let i = segs.length - 1; i >= 0; i--) {
    const prevEnd = i === 0 ? start : segs[i - 1][2];
    out.push([segs[i][1], segs[i][0], prevEnd]);
  }
  return out;
}

/** Outline of piece i in board units, clockwise from its top-left corner. */
export function pieceOutline(edges: JigsawEdges, i: number): { start: Pt; segs: Seg[] } {
  const c = i % edges.cols;
  const r = Math.floor(i / edges.cols);
  const top = r > 0 ? edges.h[r][c] : null;
  const bottom = r < edges.rows - 1 ? edges.h[r + 1][c] : null;
  const left = c > 0 ? edges.v[r][c] : null;
  const right = c < edges.cols - 1 ? edges.v[r][c + 1] : null;
  const segs: Seg[] = [];
  segs.push(...edgeSegs(top, true, c, r));
  segs.push(...edgeSegs(right, false, c + 1, r));
  segs.push(...reverseSegs([c, r + 1], edgeSegs(bottom, true, c, r + 1)));
  segs.push(...reverseSegs([c, r], edgeSegs(left, false, c, r)));
  return { start: [c, r], segs };
}

/**
 * SVG path for piece i in the piece's own box, where the box is (1 + 2*PAD) * size pixels
 * and the piece's cell starts at (PAD*size, PAD*size).
 */
export function piecePathD(edges: JigsawEdges, i: number, size: number): string {
  const c = i % edges.cols;
  const r = Math.floor(i / edges.cols);
  const { start, segs } = pieceOutline(edges, i);
  const tx = (p: Pt) => `${((p[0] - c + JIGSAW_PAD) * size).toFixed(2)} ${((p[1] - r + JIGSAW_PAD) * size).toFixed(2)}`;
  return `M ${tx(start)} ` + segs.map((s) => `C ${tx(s[0])} ${tx(s[1])} ${tx(s[2])}`).join(" ") + " Z";
}

/** SVG path of piece i in board coordinates scaled by `size` (used to draw cut lines over a preview). */
export function boardPathD(edges: JigsawEdges, i: number, size: number): string {
  const { start, segs } = pieceOutline(edges, i);
  const tx = (p: Pt) => `${(p[0] * size).toFixed(1)} ${(p[1] * size).toFixed(1)}`;
  return `M ${tx(start)} ` + segs.map((s) => `C ${tx(s[0])} ${tx(s[1])} ${tx(s[2])}`).join(" ") + " Z";
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export interface JPiece {
  /** top-left of the piece's cell, in board units; board spans [0,cols] x [0,rows] */
  x: number;
  y: number;
  rot: number;
  group: number;
  inTray: boolean;
  locked: boolean;
}

export interface JigsawState {
  kind: "jigsaw";
  rows: number;
  cols: number;
  pieces: JPiece[];
  tray: number[];
  moves: number;
  solved: boolean;
}

/** How far around the board loose pieces may be placed, in piece units. */
export const TABLE_MARGIN = 1;
export const SNAP_TOLERANCE = 0.25;

export function initJigsaw(spec: PuzzleSpec, rules: ModeRules): JigsawState {
  const n = spec.rows * spec.cols;
  const ids = Array.from({ length: n }, (_, i) => i);
  let tray = shuffle(rngFor(spec.seed, "order"), ids);
  if (rules.edgesFirst) {
    tray = [...tray.filter((i) => isEdgePiece(i, spec.rows, spec.cols)), ...tray.filter((i) => !isEdgePiece(i, spec.rows, spec.cols))];
  }
  const rotRng = rngFor(spec.seed, "rot");
  const pieces = ids.map((i) => ({
    x: 0, y: 0, rot: rules.rotation ? randInt(rotRng, 0, 3) : 0, group: i, inTray: true, locked: false,
  }));
  return { kind: "jigsaw", rows: spec.rows, cols: spec.cols, pieces, tray, moves: 0, solved: false };
}

const home = (s: JigsawState, i: number) => ({ x: i % s.cols, y: Math.floor(i / s.cols) });

function groupMembers(s: JigsawState, g: number): number[] {
  const out: number[] = [];
  s.pieces.forEach((p, i) => p.group === g && out.push(i));
  return out;
}

function translate(s: JigsawState, members: number[], dx: number, dy: number) {
  for (const m of members) {
    s.pieces[m].x += dx;
    s.pieces[m].y += dy;
  }
}

function neighbours(s: JigsawState, i: number): number[] {
  const c = i % s.cols, r = Math.floor(i / s.cols);
  const out: number[] = [];
  if (c > 0) out.push(i - 1);
  if (c < s.cols - 1) out.push(i + 1);
  if (r > 0) out.push(i - s.cols);
  if (r < s.rows - 1) out.push(i + s.cols);
  return out;
}

/** Joins the moved group with any correctly aligned neighbour, then snaps it to the board. */
function settle(s: JigsawState, group: number, rules: ModeRules) {
  let joined = true;
  while (joined) {
    joined = false;
    const members = groupMembers(s, group);
    outer: for (const m of members) {
      const pm = s.pieces[m];
      if (pm.rot !== 0) continue;
      for (const q of neighbours(s, m)) {
        const pq = s.pieces[q];
        if (pq.group === group || pq.inTray || pq.rot !== 0) continue;
        const hm = home(s, m), hq = home(s, q);
        const ex = pm.x + (hq.x - hm.x), ey = pm.y + (hq.y - hm.y);
        if (Math.abs(pq.x - ex) < SNAP_TOLERANCE && Math.abs(pq.y - ey) < SNAP_TOLERANCE) {
          // move our group onto the neighbour's group (the neighbour may already be locked)
          translate(s, members, pq.x - ex, pq.y - ey);
          const other = pq.group;
          const otherLocked = pq.locked;
          for (const p of s.pieces) if (p.group === other) p.group = group;
          if (otherLocked) for (const mm of groupMembers(s, group)) s.pieces[mm].locked = true;
          joined = true;
          break outer;
        }
      }
    }
  }
  const members = groupMembers(s, group);
  if (rules.lock && !s.pieces[members[0]].locked) {
    const m = members[0];
    const pm = s.pieces[m];
    const h = home(s, m);
    if (pm.rot === 0 && Math.abs(pm.x - h.x) < SNAP_TOLERANCE && Math.abs(pm.y - h.y) < SNAP_TOLERANCE) {
      translate(s, members, h.x - pm.x, h.y - pm.y);
      for (const mm of members) s.pieces[mm].locked = true;
    }
  }
}

function isSolved(s: JigsawState, rules: ModeRules): boolean {
  if (rules.lock) return s.pieces.every((p) => p.locked);
  const g = s.pieces[0].group;
  return s.pieces.every((p) => p.group === g && p.rot === 0 && !p.inTray);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Pure reducer shared by the client and the server-side replay. */
export function reduceJigsaw(prev: JigsawState, action: JigsawAction, rules: ModeRules): JigsawState {
  if (prev.solved) return prev;
  const n = prev.pieces.length;
  if (!Number.isInteger(action.piece) || action.piece < 0 || action.piece >= n) return prev;
  const target = prev.pieces[action.piece];
  if (target.locked) return prev;
  const s: JigsawState = { ...prev, pieces: prev.pieces.map((p) => ({ ...p })), tray: prev.tray.slice() };
  const piece = action.piece;
  const p = s.pieces[piece];
  const members = groupMembers(s, p.group);

  if (action.type === "rotate") {
    if (!rules.rotation || members.length > 1) return prev;
    p.rot = (p.rot + 1) % 4;
    if (!p.inTray) settle(s, p.group, rules);
  } else if (action.type === "tray") {
    if (p.inTray || members.length > 1) return prev;
    p.inTray = true;
    s.tray.unshift(piece);
  } else {
    if (!Number.isFinite(action.x) || !Number.isFinite(action.y)) return prev;
    const x = clamp(action.x, -TABLE_MARGIN, s.cols + TABLE_MARGIN - 1);
    const y = clamp(action.y, -TABLE_MARGIN, s.rows + TABLE_MARGIN - 1);
    if (p.inTray) {
      p.inTray = false;
      s.tray.splice(s.tray.indexOf(piece), 1);
      p.x = x;
      p.y = y;
    } else {
      translate(s, members, x - p.x, y - p.y);
    }
    settle(s, p.group, rules);
  }
  s.moves++;
  s.solved = isSolved(s, rules);
  if (s.solved) for (const q of s.pieces) q.locked = true;
  return s;
}

export function lockedCount(s: JigsawState): number {
  return s.pieces.filter((p) => p.locked).length;
}
