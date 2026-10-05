import { cleanL10n, cleanText, isInt, isMode, isPreview, isShape } from "@/lib/server/validate";
import { badRequest, json, notConfigured, rateLimited, readJson } from "@/lib/server-utils";
import { getAdmin, getUserFromRequest } from "@/lib/supabase/server";

interface LocalAttempt {
  id: string;
  createdAt: number;
  sourceKind: string;
  sourceId: string;
  title: unknown;
  pieces: number;
  shape: string;
  mode: string;
  preview: string;
  durationMs: number;
  penaltyMs: number;
  moves: number;
  quizCorrect: number;
  quizTotal: number;
  score: number;
}

/** Copies guest history from this device into the account. Imported games never count for rankings. */
export async function POST(req: Request) {
  const db = getAdmin();
  if (!db) return notConfigured();
  if (rateLimited(req, "import", 5)) return json({ error: "rate-limited" }, 429);
  const user = await getUserFromRequest(req);
  if (!user) return json({ error: "login-required" }, 401);
  const b = await readJson<{ attempts: LocalAttempt[] }>(req, 1_000_000);
  if (!b || !Array.isArray(b.attempts)) return badRequest("bad-json");
  await db.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
  const rows = b.attempts.slice(0, 500).flatMap((a) => {
    if (!isShape(a.shape) || !isMode(a.mode) || !isPreview(a.preview) || !isInt(a.pieces, 4, 200)) return [];
    if (!isInt(a.durationMs, 0, 86_400_000) || !isInt(a.penaltyMs, 0, 86_400_000)) return [];
    const at = new Date(Number(a.createdAt) || Date.now()).toISOString();
    return [{
      user_id: user.id,
      artwork_id: a.sourceKind === "library" ? cleanText(a.sourceId, 64) : null,
      source_kind: cleanText(a.sourceKind, 16),
      title: cleanL10n(a.title),
      pieces: a.pieces, rows: 0, cols: 0, shape: a.shape, mode: a.mode, preview: a.preview, seed: 0,
      server_started_at: at, server_finished_at: at, created_at: at,
      duration_ms: a.durationMs, penalty_ms: a.penaltyMs, total_ms: a.durationMs + a.penaltyMs,
      moves: isInt(a.moves, 0, 100000) ? a.moves : 0,
      quiz_correct: isInt(a.quizCorrect, 0, 3) ? a.quizCorrect : null,
      quiz_total: isInt(a.quizTotal, 0, 3) ? a.quizTotal : null,
      score: isInt(a.score, 0, 1_000_000) ? a.score : 0,
      status: "unranked",
      flag_reason: "imported",
      client_id: cleanText(a.id, 64),
    }];
  });
  if (!rows.length) return json({ imported: 0 });
  const { error, count } = await db.from("attempts").upsert(rows, { onConflict: "user_id,client_id", ignoreDuplicates: true, count: "exact" });
  if (error) return json({ error: error.message }, 500);
  return json({ imported: count ?? rows.length });
}
