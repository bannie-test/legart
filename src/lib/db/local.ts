"use client";
import Dexie, { type EntityTable } from "dexie";
import type { GameConfig } from "../game-config";
import type { GameState } from "../puzzle/game";
import type { LogEntry, Mode, PreviewPolicy, Shape } from "../puzzle/types";
import type { L10n } from "@/content/types";

export interface LocalImage {
  id: string;
  name: string;
  blob: Blob;
  width: number;
  height: number;
  aspect: string;
  focusX: number;
  focusY: number;
  createdAt: number;
  cloudId?: string;
}

export type AttemptStatus = "local" | "ranked" | "unranked" | "flagged";

export interface AttemptRecord {
  id: string;
  createdAt: number;
  sourceKind: string;
  /** library id, local image id, cloud image id or challenge code */
  sourceId: string;
  title: L10n;
  pieces: number;
  shape: Shape;
  mode: Mode;
  preview: PreviewPolicy;
  durationMs: number;
  penaltyMs: number;
  totalMs: number;
  moves: number;
  peeks: number;
  hints: number;
  quizCorrect: number;
  quizTotal: number;
  score: number;
  status: AttemptStatus;
  cloudId?: string;
  challengeCode?: string;
  rank?: number;
}

export interface SavedGame {
  key: "current";
  config: GameConfig;
  seed: number;
  state: GameState;
  log: LogEntry[];
  elapsedMs: number;
  attemptId: string | null;
  savedAt: number;
}

const db = new Dexie("legart") as Dexie & {
  images: EntityTable<LocalImage, "id">;
  attempts: EntityTable<AttemptRecord, "id">;
  saved: EntityTable<SavedGame, "key">;
};

db.version(1).stores({
  images: "id, createdAt",
  attempts: "id, createdAt, sourceId, [sourceId+pieces+shape+mode]",
  saved: "key",
});

export { db };

export function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Best previous total for the same configuration, before the current attempt was added. */
export async function previousBest(a: Pick<AttemptRecord, "sourceId" | "pieces" | "shape" | "mode" | "id">): Promise<number | null> {
  const rows = await db.attempts.where("[sourceId+pieces+shape+mode]").equals([a.sourceId, a.pieces, a.shape, a.mode]).toArray();
  const others = rows.filter((r) => r.id !== a.id);
  return others.length ? Math.min(...others.map((r) => r.totalMs)) : null;
}
