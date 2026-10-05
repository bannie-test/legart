import { initJigsaw, reduceJigsaw, type JigsawState } from "./jigsaw";
import { rulesFor, type ModeRules } from "./modes";
import { initSquare, reduceSquare, type SquareState } from "./square";
import type { Action, JigsawAction, LogEntry, PuzzleSpec, SquareAction } from "./types";

export type GameState = SquareState | JigsawState;

export function initGame(spec: PuzzleSpec): GameState {
  const rules = rulesFor(spec.mode, spec.shape);
  return spec.shape === "square" ? initSquare(spec, rules) : initJigsaw(spec, rules);
}

export function reduceGame(state: GameState, action: Action, rules: ModeRules): GameState {
  if (action.type === "hint" || action.type === "peek") return state;
  if (state.kind === "square") return reduceSquare(state, action as SquareAction, rules);
  return reduceJigsaw(state, action as JigsawAction, rules);
}

export interface Penalties {
  hints: number;
  peeks: number;
  penaltyMs: number;
}

export function penaltiesFromLog(log: LogEntry[], rules: ModeRules): Penalties {
  const hints = log.filter((e) => e.a.type === "hint").length;
  const peeks = log.filter((e) => e.a.type === "peek").length;
  return { hints, peeks, penaltyMs: hints * rules.hintPenaltyMs + peeks * rules.peekPenaltyMs };
}

export interface ReplayResult {
  ok: boolean;
  reason?: string;
  solved: boolean;
  moves: number;
  /** clock time of the last entry, ms */
  durationMs: number;
  penalties: Penalties;
}

/** Fastest plausible human pace; anything quicker is rejected. */
export const MIN_MS_PER_PIECE = 400;

/** Replays a move log from scratch. Used by the server before a time goes on a leaderboard. */
export function replay(spec: PuzzleSpec, log: LogEntry[]): ReplayResult {
  const rules = rulesFor(spec.mode, spec.shape);
  let state = initGame(spec);
  let lastT = 0;
  const fail = (reason: string): ReplayResult => ({
    ok: false, reason, solved: false, moves: state.moves, durationMs: lastT, penalties: penaltiesFromLog(log, rules),
  });
  if (!Array.isArray(log) || log.length > 20000) return fail("bad-log");
  for (const entry of log) {
    if (!entry || typeof entry.t !== "number" || !entry.a || typeof entry.a.type !== "string") return fail("bad-entry");
    if (entry.t < lastT) return fail("time-goes-backwards");
    lastT = entry.t;
    state = reduceGame(state, entry.a, rules);
  }
  const penalties = penaltiesFromLog(log, rules);
  if (rules.hintLimit >= 0 && penalties.hints > rules.hintLimit) return fail("too-many-hints");
  if (rules.maxPeeks >= 0 && penalties.peeks > rules.maxPeeks) return fail("too-many-peeks");
  if (!state.solved) return fail("not-solved");
  if (lastT < spec.rows * spec.cols * MIN_MS_PER_PIECE) return fail("too-fast");
  return { ok: true, solved: true, moves: state.moves, durationMs: lastT, penalties };
}

export function progress(state: GameState): number {
  if (state.kind === "square") {
    const ok = state.cells.filter((p, i) => p === i && state.rot[i] === 0).length;
    return ok / state.cells.length;
  }
  return state.pieces.filter((p) => p.locked).length / state.pieces.length;
}
