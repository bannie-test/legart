import { getArtwork } from "@/content/artworks";
import { getChallenge } from "@/lib/server/data";
import { cleanL10n, cleanText, isInt, isMode, isPreview, isShape, MAX_GRID, MAX_PIECES } from "@/lib/server/validate";
import { badRequest, json, notConfigured, rateLimited, readJson } from "@/lib/server-utils";
import { getAdmin, getUserFromRequest } from "@/lib/supabase/server";

interface Body {
  sourceKind: string;
  sourceId: string;
  title: unknown;
  rows: number;
  cols: number;
  shape: string;
  mode: string;
  preview: string;
  challengeCode?: string;
  guestName?: string;
}

/** Opens an attempt and hands out the server-chosen seed (or the challenge's seed). */
export async function POST(req: Request) {
  const db = getAdmin();
  if (!db) return notConfigured();
  if (rateLimited(req, "start", 30)) return json({ error: "rate-limited" }, 429);
  const b = await readJson<Body>(req, 10_000);
  if (!b) return badRequest("bad-json");
  if (!isInt(b.rows, 1, MAX_GRID) || !isInt(b.cols, 1, MAX_GRID) || b.rows * b.cols < 4 || b.rows * b.cols > MAX_PIECES) return badRequest("bad-grid");
  if (!isShape(b.shape) || !isMode(b.mode) || !isPreview(b.preview)) return badRequest("bad-config");

  const user = await getUserFromRequest(req);
  const challenge = b.challengeCode ? await getChallenge(cleanText(b.challengeCode, 10).toUpperCase()) : null;
  if (b.challengeCode && !challenge) return json({ error: "challenge-not-found" }, 404);
  if (challenge) {
    if (challenge.expires_at && new Date(challenge.expires_at) < new Date()) return json({ error: "challenge-expired" }, 410);
    if (challenge.rows !== b.rows || challenge.cols !== b.cols || challenge.shape !== b.shape || challenge.mode !== b.mode || challenge.preview !== b.preview)
      return badRequest("challenge-mismatch");
  }
  if (!user && !challenge) return json({ error: "login-required" }, 401);

  let artworkId: string | null = challenge?.artwork_id ?? null;
  if (!challenge && b.sourceKind === "library") {
    if (!getArtwork(String(b.sourceId))) return badRequest("unknown-artwork");
    artworkId = String(b.sourceId);
  }
  if (user) await db.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  const seed = challenge?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0];
  const { data, error } = await db
    .from("attempts")
    .insert({
      user_id: user?.id ?? null,
      guest_name: user ? null : cleanText(b.guestName, 24) || "Guest",
      challenge_id: challenge?.id ?? null,
      artwork_id: artworkId,
      source_kind: challenge ? "challenge" : cleanText(b.sourceKind, 16),
      title: challenge?.title ?? cleanL10n(b.title),
      pieces: b.rows * b.cols,
      rows: b.rows,
      cols: b.cols,
      shape: b.shape,
      mode: b.mode,
      preview: b.preview,
      seed,
      status: "started",
    })
    .select("id")
    .single();
  if (error) return json({ error: error.message }, 500);
  return json({ attemptId: data.id, seed: Number(seed) });
}
