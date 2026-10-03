import { badRequest, dataUrlToBuffer, json, notConfigured, rateLimited, readJson } from "@/lib/server-utils";
import { getAdmin, getUserFromRequest } from "@/lib/supabase/server";

/** Stores the achievement card publicly and returns the share page URL (/s/<id>). */
export async function POST(req: Request) {
  const db = getAdmin();
  if (!db) return notConfigured();
  if (rateLimited(req, "share", 10)) return json({ error: "rate-limited" }, 429);
  const user = await getUserFromRequest(req);
  if (!user) return json({ error: "login-required" }, 401);
  const b = await readJson<{ attemptId: string; imageDataUrl: string; locale?: string }>(req, 6_000_000);
  if (!b || typeof b.attemptId !== "string") return badRequest("bad-json");
  const { data: att } = await db.from("attempts").select("id, user_id, status").eq("id", b.attemptId).maybeSingle();
  if (!att || att.user_id !== user.id) return json({ error: "not-found" }, 404);
  if (!["ranked", "unranked"].includes(att.status)) return badRequest("attempt-not-finished");
  const img = dataUrlToBuffer(String(b.imageDataUrl ?? ""), ["image/png", "image/jpeg"]);
  if (!img || img.buf.length > 4_000_000) return badRequest("bad-image");
  const id = crypto.randomUUID();
  const ext = img.type === "image/png" ? "png" : "jpg";
  const path = `shares/${id}.${ext}`;
  const up = await db.storage.from("public-images").upload(path, img.buf, { contentType: img.type });
  if (up.error) return json({ error: up.error.message }, 500);
  const { error } = await db.from("shares").insert({ id, attempt_id: att.id, user_id: user.id, image_path: path, locale: b.locale === "vi" ? "vi" : "en" });
  if (error) return json({ error: error.message }, 500);
  return json({ id, url: `/s/${id}` });
}
