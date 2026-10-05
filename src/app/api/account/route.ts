import { json, notConfigured, rateLimited } from "@/lib/server-utils";
import { getAdmin, getUserFromRequest } from "@/lib/supabase/server";

/** Deletes the signed-in user's account, uploaded pictures and history. */
export async function DELETE(req: Request) {
  const db = getAdmin();
  if (!db) return notConfigured();
  if (rateLimited(req, "account", 3)) return json({ error: "rate-limited" }, 429);
  const user = await getUserFromRequest(req);
  if (!user) return json({ error: "login-required" }, 401);
  const { data: files } = await db.storage.from("user-images").list(user.id, { limit: 1000 });
  if (files?.length) await db.storage.from("user-images").remove(files.map((f) => `${user.id}/${f.name}`));
  const { data: shares } = await db.from("shares").select("image_path").eq("user_id", user.id);
  const { data: chals } = await db.from("challenges").select("image_path").eq("creator_id", user.id);
  const publicFiles = [...(shares ?? []), ...(chals ?? [])].map((r) => r.image_path).filter(Boolean) as string[];
  if (publicFiles.length) await db.storage.from("public-images").remove(publicFiles);
  await db.from("challenges").delete().eq("creator_id", user.id);
  // profiles, attempts, shares and user_images cascade from auth.users
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}
