"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/components/Providers";
import { db, newId } from "@/lib/db/local";
import { focusCrop } from "@/lib/mosaic/client";
import { parseAspect } from "@/lib/puzzle/grid";

const ASPECTS = ["1:1", "4:5", "3:4", "4:3", "3:2", "16:9"];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 1600;

/** Re-encodes to JPEG (drops EXIF incl. GPS) and limits the long side. */
async function normalise(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.88));
  return { blob, width: canvas.width, height: canvas.height };
}

export default function UploadPage() {
  const t = useTranslations("upload");
  const router = useRouter();
  const { user, supabase } = useApp();
  const [img, setImg] = useState<{ blob: Blob; width: number; height: number; url: string } | null>(null);
  const [name, setName] = useState("");
  const [aspect, setAspect] = useState("1:1");
  const [focus, setFocus] = useState({ x: 0.5, y: 0.5 });
  const [cloud, setCloud] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (img) URL.revokeObjectURL(img.url); }, [img]);

  async function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError(t("errType"));
    if (file.size > MAX_BYTES) return setError(t("errSize"));
    try {
      const n = await normalise(file);
      setImg({ ...n, url: URL.createObjectURL(n.blob) });
      setName(file.name.replace(/\.[^.]+$/, "").slice(0, 60));
      setFocus({ x: 0.5, y: 0.5 });
    } catch {
      setError(t("errRead"));
    }
  }

  async function save() {
    if (!img) return;
    setBusy(true);
    setError(null);
    try {
      const id = newId();
      let cloudId: string | undefined;
      if (cloud && user && supabase) {
        const path = `${user.id}/${id}.jpg`;
        const up = await supabase.storage.from("user-images").upload(path, img.blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        const ins = await supabase.from("user_images").insert({
          id, owner_id: user.id, title: name || "Untitled", storage_path: path, width: img.width, height: img.height,
          aspect, focus_x: focus.x, focus_y: focus.y,
        });
        if (ins.error) throw ins.error;
        cloudId = id;
      }
      await db.images.put({ id, name: name || "Untitled", blob: img.blob, width: img.width, height: img.height, aspect, focusX: focus.x, focusY: focus.y, createdAt: Date.now(), cloudId });
      router.push(`/setup?src=local:${id}`);
    } catch (e) {
      setError(`${t("errSave")} ${(e as Error).message ?? ""}`);
      setBusy(false);
    }
  }

  const crop = img ? focusCrop(img.width, img.height, parseAspect(aspect), focus.x, focus.y) : null;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-sm muted">{t("privacy")}</p>

      <label className="card flex cursor-pointer flex-col items-center gap-2 p-6 text-center">
        <span className="text-4xl">🖼️</span>
        <span className="font-semibold">{img ? t("change") : t("pick")}</span>
        <span className="text-xs muted">{t("limits")}</span>
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}

      {img && crop && (
        <>
          <div>
            <div className="mb-2 text-sm font-semibold">{t("aspect")}</div>
            <div className="flex flex-wrap gap-2">
              {ASPECTS.map((a) => (
                <button key={a} className="chip" aria-pressed={a === aspect} onClick={() => setAspect(a)}>{a}</button>
              ))}
            </div>
          </div>
          <div
            ref={boxRef}
            className="relative w-full select-none overflow-hidden rounded-xl"
            style={{ aspectRatio: `${img.width} / ${img.height}` }}
            onPointerDown={(e) => {
              const r = boxRef.current!.getBoundingClientRect();
              setFocus({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
            }}
          >
            <img src={img.url} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
            <div
              className="pointer-events-none absolute border-2 border-white"
              style={{
                left: `${(crop.x / img.width) * 100}%`, top: `${(crop.y / img.height) * 100}%`,
                width: `${(crop.w / img.width) * 100}%`, height: `${(crop.h / img.height) * 100}%`,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
              }}
            />
          </div>
          <p className="text-xs muted">{t("tapToMove")}</p>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{t("name")}</span>
            <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </label>
          {user && supabase ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cloud} onChange={(e) => setCloud(e.target.checked)} /> {t("cloud")}
            </label>
          ) : supabase ? (
            <p className="text-xs muted">{t("loginForCloud")}</p>
          ) : null}
          <button className="btn btn-primary w-full" disabled={busy} onClick={save}>{busy ? t("saving") : t("save")}</button>
        </>
      )}
    </div>
  );
}
