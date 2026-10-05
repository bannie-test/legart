"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let clientKey = "";

export function getBrowserClient(url: string | null, anonKey: string | null): SupabaseClient | null {
  if (!url || !anonKey) return null;
  const key = `${url}|${anonKey}`;
  if (!client || clientKey !== key) {
    client = createClient(url, anonKey, {
      auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
    });
    clientKey = key;
  }
  return client;
}
