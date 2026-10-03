import "server-only";
import { NextResponse } from "next/server";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
export const notConfigured = () => json({ error: "backend-not-configured" }, 503);
export const badRequest = (error: string) => json({ error }, 400);

const buckets = new Map<string, { tokens: number; at: number }>();

/** Small in-memory token bucket per client IP. Good enough for a single container. */
export function rateLimited(req: Request, key: string, perMinute: number): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const id = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(id) ?? { tokens: perMinute, at: now };
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60000) * perMinute);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(id, b);
    return true;
  }
  b.tokens -= 1;
  buckets.set(id, b);
  if (buckets.size > 10000) buckets.clear();
  return false;
}

export async function readJson<T>(req: Request, maxBytes = 2_000_000): Promise<T | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function randomCode(len = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function dataUrlToBuffer(dataUrl: string, allowed = ["image/jpeg", "image/png", "image/webp"]): { buf: Buffer; type: string } | null {
  const m = /^data:([a-z/]+);base64,(.+)$/.exec(dataUrl);
  if (!m || !allowed.includes(m[1])) return null;
  return { buf: Buffer.from(m[2], "base64"), type: m[1] };
}
