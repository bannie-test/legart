import { challengeBoard, challengeImageUrl, getChallenge } from "@/lib/server/data";
import { json, notConfigured, rateLimited } from "@/lib/server-utils";
import { getAdmin } from "@/lib/supabase/server";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  if (!getAdmin()) return notConfigured();
  if (rateLimited(req, "challenge-get", 120)) return json({ error: "rate-limited" }, 429);
  const { code } = await ctx.params;
  const c = await getChallenge(code.toUpperCase());
  if (!c) return json({ error: "not-found" }, 404);
  return json({
    code: c.code,
    title: c.title,
    artworkId: c.artwork_id,
    imageUrl: challengeImageUrl(c),
    rows: c.rows,
    cols: c.cols,
    shape: c.shape,
    mode: c.mode,
    preview: c.preview,
    seed: Number(c.seed),
    mosaic: c.mosaic,
    questions: c.questions,
    expiresAt: c.expires_at,
    expired: c.expires_at ? new Date(c.expires_at) < new Date() : false,
    leaderboard: await challengeBoard(c.id),
  });
}
