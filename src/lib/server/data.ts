import "server-only";
import { getAdmin, publicStorageUrl } from "../supabase/server";
import { libraryImage } from "@/content/artworks";
import type { L10n, QuizQuestion } from "@/content/types";
import type { ArtStyle, StoredMosaic } from "../game-config";
import type { Mode, PreviewPolicy, Shape } from "../puzzle/types";

export interface ChallengeRow {
  id: string;
  code: string;
  creator_id: string | null;
  source_kind: "library" | "image";
  artwork_id: string | null;
  image_path: string | null;
  title: L10n;
  rows: number;
  cols: number;
  shape: Shape;
  mode: Mode;
  preview: PreviewPolicy;
  seed: number;
  style: ArtStyle;
  /** null for photo puzzles */
  mosaic: StoredMosaic | null;
  questions: QuizQuestion[];
  expires_at: string | null;
  created_at: string;
}

export interface BoardEntry {
  name: string;
  totalMs: number;
  createdAt: string;
  isGuest: boolean;
}

export function challengeImageUrl(c: Pick<ChallengeRow, "artwork_id" | "image_path">): string | null {
  if (c.artwork_id) return libraryImage(c.artwork_id);
  return c.image_path ? publicStorageUrl(c.image_path) : null;
}

export async function getChallenge(code: string): Promise<ChallengeRow | null> {
  const db = getAdmin();
  if (!db || !/^[A-Z0-9]{4,10}$/.test(code)) return null;
  const { data } = await db.from("challenges").select("*").eq("code", code).maybeSingle();
  return (data as ChallengeRow) ?? null;
}

interface AttemptBoardRow {
  user_id: string | null;
  guest_name: string | null;
  total_ms: number;
  created_at: string;
  profiles: { display_name: string } | null;
}

/** Best ranked time per player, fastest first. */
export function dedupeBoard(rows: AttemptBoardRow[], limit = 50): BoardEntry[] {
  const seen = new Set<string>();
  const out: BoardEntry[] = [];
  for (const r of rows) {
    const key = r.user_id ?? `guest:${r.guest_name ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: r.profiles?.display_name ?? r.guest_name ?? "Guest", totalMs: r.total_ms, createdAt: r.created_at, isGuest: !r.user_id });
    if (out.length >= limit) break;
  }
  return out;
}

export async function challengeBoard(challengeId: string): Promise<BoardEntry[]> {
  const db = getAdmin();
  if (!db) return [];
  const { data } = await db
    .from("attempts")
    .select("user_id, guest_name, total_ms, created_at, profiles(display_name)")
    .eq("challenge_id", challengeId)
    .eq("status", "ranked")
    .order("total_ms", { ascending: true })
    .limit(300);
  return dedupeBoard((data ?? []) as unknown as AttemptBoardRow[]);
}

export interface ShareRow {
  id: string;
  image_path: string;
  locale: string;
  created_at: string;
  attempts: {
    title: L10n;
    artwork_id: string | null;
    pieces: number;
    shape: Shape;
    mode: Mode;
    total_ms: number;
    quiz_correct: number | null;
    quiz_total: number | null;
    challenge_id: string | null;
    guest_name: string | null;
    profiles: { display_name: string } | null;
    challenges: { code: string } | null;
  } | null;
}

export async function getShare(id: string): Promise<ShareRow | null> {
  const db = getAdmin();
  if (!db || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await db
    .from("shares")
    .select("id, image_path, locale, created_at, attempts(title, artwork_id, pieces, shape, mode, total_ms, quiz_correct, quiz_total, challenge_id, guest_name, profiles(display_name), challenges(code))")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as ShareRow) ?? null;
}
