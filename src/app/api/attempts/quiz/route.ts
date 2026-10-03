import { isInt } from "@/lib/server/validate";
import { badRequest, json, notConfigured, rateLimited, readJson } from "@/lib/server-utils";
import { getAdmin, getUserFromRequest } from "@/lib/supabase/server";

/** Stores the quiz result of a finished attempt (once). */
export async function POST(req: Request) {
  const db = getAdmin();
  if (!db) return notConfigured();
  if (rateLimited(req, "quiz", 30)) return json({ error: "rate-limited" }, 429);
  const b = await readJson<{ attemptId: string; correct: number; total: number; quizScore: number }>(req, 2000);
  if (!b || typeof b.attemptId !== "string" || !isInt(b.total, 0, 3) || !isInt(b.correct, 0, b.total) || !isInt(b.quizScore, 0, b.correct * 700))
    return badRequest("bad-json");
  const { data: row } = await db.from("attempts").select("id, user_id, status, score, quiz_total").eq("id", b.attemptId).maybeSingle();
  if (!row) return json({ error: "not-found" }, 404);
  if (row.status === "started" || row.quiz_total !== null) return json({ error: "conflict" }, 409);
  if (row.user_id) {
    const user = await getUserFromRequest(req);
    if (user?.id !== row.user_id) return json({ error: "forbidden" }, 403);
  }
  await db.from("attempts").update({ quiz_correct: b.correct, quiz_total: b.total, score: (row.score ?? 0) + b.quizScore }).eq("id", row.id);
  return json({ ok: true });
}
