import { replay } from "@/lib/puzzle/game";
import { puzzleScore } from "@/lib/puzzle/scoring";
import type { LogEntry, Mode, Shape } from "@/lib/puzzle/types";
import { badRequest, json, notConfigured, rateLimited, readJson } from "@/lib/server-utils";
import { getAdmin, getUserFromRequest } from "@/lib/supabase/server";

const COUNTDOWN_MS = 3000;
/** Time between opening the attempt and the clock starting (piece generation, countdown, network). */
const START_SLACK_MS = 30_000;
const CLOCK_TOLERANCE_MS = 3000;

/** Replays the move log and records the verified time. */
export async function POST(req: Request) {
  const db = getAdmin();
  if (!db) return notConfigured();
  if (rateLimited(req, "finish", 30)) return json({ error: "rate-limited" }, 429);
  const b = await readJson<{ attemptId: string; log: LogEntry[]; unranked?: boolean }>(req, 3_000_000);
  if (!b || typeof b.attemptId !== "string" || !Array.isArray(b.log)) return badRequest("bad-json");

  const { data: row } = await db.from("attempts").select("*").eq("id", b.attemptId).maybeSingle();
  if (!row) return json({ error: "not-found" }, 404);
  if (row.status !== "started") return json({ error: "already-finished" }, 409);
  if (row.user_id) {
    const user = await getUserFromRequest(req);
    if (user?.id !== row.user_id) return json({ error: "forbidden" }, 403);
  }

  const spec = { rows: row.rows, cols: row.cols, shape: row.shape as Shape, mode: row.mode as Mode, seed: Number(row.seed) };
  const r = replay(spec, b.log);
  const serverElapsed = Date.now() - new Date(row.server_started_at).getTime();
  let status: "ranked" | "unranked" | "flagged" = "ranked";
  let reason: string | null = null;
  if (!r.ok) [status, reason] = ["flagged", r.reason ?? "invalid"];
  // resumed / backgrounded games keep a valid record but never compete
  else if (b.unranked) status = "unranked";
  else if (r.durationMs > serverElapsed - COUNTDOWN_MS + CLOCK_TOLERANCE_MS) [status, reason] = ["flagged", "clock-ahead"];
  else if (r.durationMs < serverElapsed - COUNTDOWN_MS - START_SLACK_MS) [status, reason] = ["flagged", "clock-behind"];

  const totalMs = r.durationMs + r.penalties.penaltyMs;
  const { error } = await db
    .from("attempts")
    .update({
      status,
      flag_reason: reason,
      server_finished_at: new Date().toISOString(),
      duration_ms: r.durationMs,
      penalty_ms: r.penalties.penaltyMs,
      total_ms: totalMs,
      moves: r.moves,
      peeks: r.penalties.peeks,
      hints: r.penalties.hints,
      score: r.ok ? puzzleScore(totalMs, spec.mode, spec.shape, row.pieces) : 0,
    })
    .eq("id", row.id)
    .eq("status", "started");
  if (error) return json({ error: error.message }, 500);

  let rank: number | null = null;
  if (status === "ranked" && ((row.source_kind === "challenge" && row.challenge_id) || row.artwork_id)) {
    let q = db.from("attempts").select("id", { count: "exact", head: true }).eq("status", "ranked").lt("total_ms", totalMs);
    if (row.source_kind === "challenge") q = q.eq("challenge_id", row.challenge_id);
    else {
      q = q.eq("artwork_id", row.artwork_id).neq("source_kind", "challenge").eq("pieces", row.pieces).eq("shape", row.shape).eq("mode", row.mode);
      q = row.preview === "always" ? q.eq("preview", "always") : q.neq("preview", "always");
    }
    const { count } = await q;
    rank = (count ?? 0) + 1;
  }
  return json({ status, reason, rank, totalMs });
}
