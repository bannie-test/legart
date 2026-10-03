"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getArtwork, libraryImage } from "@/content/artworks";
import type { L10n } from "@/content/types";
import { db } from "./db/local";
import type { Source } from "./game-config";
import { loadBitmap } from "./mosaic/client";

export interface ResolvedSource {
  bitmap: ImageBitmap;
  /** URL usable in <img> for the reference panel */
  url: string;
  title: L10n;
  aspect: string;
  focusX: number;
  focusY: number;
}

export class SourceError extends Error {
  constructor(public code: "missing-library-image" | "not-found" | "login-required" | "load-failed") {
    super(code);
  }
}

export async function resolveSource(src: Source, supabase: SupabaseClient | null, challengeImageUrl?: string | null): Promise<ResolvedSource> {
  if (src.kind === "library") {
    const art = getArtwork(src.id);
    if (!art) throw new SourceError("not-found");
    const url = libraryImage(art.id);
    try {
      const bitmap = await loadBitmap(url);
      return { bitmap, url, title: art.title, aspect: art.aspect, focusX: 0.5, focusY: 0.5 };
    } catch {
      throw new SourceError("missing-library-image");
    }
  }
  if (src.kind === "local") {
    const img = await db.images.get(src.id);
    if (!img) throw new SourceError("not-found");
    const url = URL.createObjectURL(img.blob);
    const bitmap = await loadBitmap(img.blob);
    return { bitmap, url, title: { en: img.name, vi: img.name }, aspect: img.aspect, focusX: img.focusX, focusY: img.focusY };
  }
  if (src.kind === "cloud") {
    if (!supabase) throw new SourceError("login-required");
    const { data: row } = await supabase.from("user_images").select("*").eq("id", src.id).maybeSingle();
    if (!row) throw new SourceError("not-found");
    const { data: signed } = await supabase.storage.from("user-images").createSignedUrl(row.storage_path, 3600);
    if (!signed?.signedUrl) throw new SourceError("load-failed");
    const bitmap = await loadBitmap(signed.signedUrl);
    return { bitmap, url: signed.signedUrl, title: { en: row.title, vi: row.title }, aspect: row.aspect, focusX: row.focus_x ?? 0.5, focusY: row.focus_y ?? 0.5 };
  }
  // challenge
  if (!challengeImageUrl) throw new SourceError("load-failed");
  try {
    const bitmap = await loadBitmap(challengeImageUrl);
    return { bitmap, url: challengeImageUrl, title: { en: "", vi: "" }, aspect: "1:1", focusX: 0.5, focusY: 0.5 };
  } catch {
    throw new SourceError("load-failed");
  }
}

export function parseSourceParam(p: string | null): Source | null {
  if (!p) return null;
  const [kind, ...rest] = p.split(":");
  const id = rest.join(":");
  if (!id) return null;
  if (kind === "library" || kind === "local" || kind === "cloud") return { kind, id };
  return null;
}
