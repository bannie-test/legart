import { getArtwork } from "@/content/artworks";
import { dedupeBoard } from "@/lib/server/data";
import { isMode, isShape } from "@/lib/server/validate";
import { badRequest, json, notConfigured, rateLimited } from "@/lib/server-utils";
import { getAdmin } from "@/lib/supabase/server";

/** GET /api/leaderboard?artwork=mona-lisa&pieces=36&shape=square&mode=easy&preview=none|always&period=all|week */
export async function GET(req: Request) {
  const db = getAdmin();
  if (!db) return notConfigured();
  if (rateLimited(req, "board", 60)) return json({ error: "rate-limited" }, 429);
  const q = new URL(req.url).searchParams;
  const artwork = q.get("artwork") ?? "";
  const pieces = Number(q.get("pieces"));
  const shape = q.get("shape");
  const mode = q.get("mode");
  if (!getArtwork(artwork) || !Number.isInteger(pieces) || !isShape(shape) || !isMode(mode)) return badRequest("bad-query");
  let query = db
    .from("attempts")
    .select("user_id, guest_name, total_ms, created_at, profiles(display_name)")
    .eq("status", "ranked")
    .eq("artwork_id", artwork)
    // games played from a challenge link reuse a shared seed, so they only count on that challenge
    .neq("source_kind", "challenge")
    .eq("pieces", pieces)
    .eq("shape", shape)
    .eq("mode", mode);
  query = q.get("preview") === "always" ? query.eq("preview", "always") : query.neq("preview", "always");
  if (q.get("period") === "week") query = query.gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString());
  const { data, error } = await query.order("total_ms", { ascending: true }).limit(300);
  if (error) return json({ error: error.message }, 500);
  return json({ entries: dedupeBoard((data ?? []) as never) });
}
