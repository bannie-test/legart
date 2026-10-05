import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/** Service-role client. Only ever used inside route handlers / server components. */
export function getAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!admin) admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export interface RequestUser {
  id: string;
  email?: string;
}

/** Resolves the Supabase user from the `Authorization: Bearer <access token>` header. */
export async function getUserFromRequest(req: Request): Promise<RequestUser | null> {
  const db = getAdmin();
  const auth = req.headers.get("authorization");
  if (!db || !auth?.startsWith("Bearer ")) return null;
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

export function publicStorageUrl(path: string): string {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/public-images/${path}`;
}
