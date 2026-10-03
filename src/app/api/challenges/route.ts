import { fromBase64 } from "@/lib/game-config";
import { cleanL10n, cleanQuestions } from "@/lib/server/validate";
import { getPalette } from "@/lib/mosaic/palettes";
import { badRequest, dataUrlToBuffer, json, notConfigured, randomCode, rateLimited, readJson } from "@/lib/server-utils";
import { getAdmin, getUserFromRequest } from "@/lib/supabase/server";

interface Body {
  attemptId: string;
  mosaic: { width: number; height: number; paletteId: string; indices: string };
  title: unknown;
  questions?: unknown;
  imageDataUrl?: string;
}

const CHALLENGE_DAYS = 7;

/** Turns one of the user's finished games into a shareable challenge with the same seed. */
export async function POST(req: Request) {
  const db = getAdmin();
  if (!db) return notConfigured();
  if (rateLimited(req, "challenge", 10)) return json({ error: "rate-limited" }, 429);
  const user = await getUserFromRequest(req);
  if (!user) return json({ error: "login-required" }, 401);
  const b = await readJson<Body>(req, 3_000_000);
  if (!b || typeof b.attemptId !== "string") return badRequest("bad-json");

  const { data: att } = await db.from("attempts").select("*").eq("id", b.attemptId).maybeSingle();
  if (!att || att.user_id !== user.id) return json({ error: "not-found" }, 404);
  if (!["ranked", "unranked"].includes(att.status)) return badRequest("attempt-not-finished");
  if (att.challenge_id) return badRequest("already-a-challenge");

  const m = b.mosaic;
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(String(m?.indices ?? ""));
  } catch {
    return badRequest("bad-mosaic");
  }
  const palette = getPalette(String(m?.paletteId));
  if (
    !Number.isInteger(m?.width) || !Number.isInteger(m?.height) || m.width % att.cols || m.height % att.rows ||
    m.width > 200 || m.height > 200 || bytes.length !== m.width * m.height || palette.id !== m.paletteId ||
    bytes.some((v) => v >= palette.colors.length)
  )
    return badRequest("bad-mosaic");

  let code = "";
  for (let i = 0; i < 6 && !code; i++) {
    const c = randomCode();
    const { count } = await db.from("challenges").select("id", { count: "exact", head: true }).eq("code", c);
    if (!count) code = c;
  }
  if (!code) return json({ error: "try-again" }, 503);

  let imagePath: string | null = null;
  if (!att.artwork_id) {
    const img = b.imageDataUrl ? dataUrlToBuffer(b.imageDataUrl, ["image/jpeg"]) : null;
    if (!img || img.buf.length > 1_500_000) return badRequest("image-required");
    imagePath = `challenges/${code}.jpg`;
    const up = await db.storage.from("public-images").upload(imagePath, img.buf, { contentType: "image/jpeg" });
    if (up.error) return json({ error: up.error.message }, 500);
  }

  const { data: ch, error } = await db
    .from("challenges")
    .insert({
      code,
      creator_id: user.id,
      source_kind: att.artwork_id ? "library" : "image",
      artwork_id: att.artwork_id,
      image_path: imagePath,
      title: att.artwork_id ? att.title : cleanL10n(b.title),
      rows: att.rows,
      cols: att.cols,
      shape: att.shape,
      mode: att.mode,
      preview: att.preview,
      seed: att.seed,
      mosaic: { width: m.width, height: m.height, paletteId: m.paletteId, indices: m.indices },
      questions: cleanQuestions(b.questions),
      expires_at: new Date(Date.now() + CHALLENGE_DAYS * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) return json({ error: error.message }, 500);
  // the creator's own time opens the challenge leaderboard
  await db.from("attempts").update({ challenge_id: ch.id }).eq("id", att.id);
  return json({ code });
}
