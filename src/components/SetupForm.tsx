"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "./Providers";
import { useL10n } from "./useL10n";
import { getArtwork } from "@/content/artworks";
import { parseSourceParam, resolveSource, SourceError, type ResolvedSource } from "@/lib/image-source";
import { buildArt } from "@/lib/art";
import { AUTO_COLOR_OPTIONS, AUTO_PALETTE_ID, DEFAULT_PALETTE_ID, PALETTES } from "@/lib/mosaic/palettes";
import { computeGrid, parseAspect, studsPerPiece } from "@/lib/puzzle/grid";
import { boardPathD, generateEdges } from "@/lib/puzzle/jigsaw";
import { rulesFor } from "@/lib/puzzle/modes";
import { DEFAULT_PIECES, DETAIL_OPTIONS, MODES, PIECE_OPTIONS, SHAPES, type Mode, type PreviewPolicy, type Shape } from "@/lib/puzzle/types";
import { ART_STYLES, saveConfig, type ArtStyle, type GameConfig } from "@/lib/game-config";

const PREFS_KEY = "legart:prefs:v2";

interface Prefs {
  pieces: number;
  shape: Shape;
  mode: Mode;
  preview: PreviewPolicy;
  style: ArtStyle;
  detail: number;
  paletteId: string;
  colorCount: number;
  dithering: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
}

const DEFAULTS: Prefs = {
  pieces: DEFAULT_PIECES, shape: "jigsaw", mode: "easy", preview: "always", style: "photo", detail: 64,
  paletteId: AUTO_PALETTE_ID, colorCount: 32, dithering: false, brightness: 0, contrast: 0, saturation: 0,
};

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function SetupForm() {
  const t = useTranslations("setup");
  const tx = useL10n();
  const router = useRouter();
  const params = useSearchParams();
  const { supabase } = useApp();
  const source = parseSourceParam(params.get("src"));
  const [res, setRes] = useState<ResolvedSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [p, setP] = useState<Prefs>(DEFAULTS);
  const [aspect, setAspect] = useState("1:1");
  const [rendering, setRendering] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => setP(loadPrefs()), []);

  useEffect(() => {
    if (!source) return;
    let alive = true;
    resolveSource(source, supabase)
      .then((r) => {
        if (!alive) return;
        setRes(r);
        setAspect(r.aspect);
      })
      .catch((e) => alive && setError(e instanceof SourceError ? e.code : "load-failed"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("src"), supabase]);

  const rules = rulesFor(p.mode, p.shape);
  const preview: PreviewPolicy = rules.previewOptions.includes(p.preview) ? p.preview : rules.previewOptions[0];
  const { rows, cols } = computeGrid(parseAspect(aspect), p.pieces);
  const k = studsPerPiece(rows, cols, p.detail);

  // fixed palettes are for bricks; "auto" (colours from the picture) is the pixel-art default
  const paletteId = p.style === "brick" && p.paletteId === AUTO_PALETTE_ID ? DEFAULT_PALETTE_ID : p.paletteId;

  // live preview with the cut lines drawn on top
  useEffect(() => {
    if (!res) return;
    let alive = true;
    setRendering(true);
    const timer = setTimeout(async () => {
      try {
        const art = await buildArt(
          res.bitmap,
          { style: p.style, rows, cols, detail: p.detail, paletteId, colorCount: p.colorCount, dithering: p.dithering,
            brightness: p.brightness, contrast: p.contrast, saturation: p.saturation, focusX: res.focusX, focusY: res.focusY },
          null,
          Math.ceil(720 / Math.max(rows, cols)),
        );
        if (!alive || !previewRef.current) return;
        const canvas = art.canvas;
        const ctx = canvas.getContext("2d")!;
        const size = canvas.width / cols;
        const paths =
          p.shape === "jigsaw"
            ? (() => {
                const edges = generateEdges(rows, cols, 7);
                return Array.from({ length: rows * cols }, (_, i) => new Path2D(boardPathD(edges, i, size)));
              })()
            : Array.from({ length: rows * cols }, (_, i) => {
                const path = new Path2D();
                path.rect((i % cols) * size, Math.floor(i / cols) * size, size, size);
                return path;
              });
        ctx.lineWidth = Math.max(1, size * 0.02);
        for (const path of paths) {
          ctx.strokeStyle = "rgba(0,0,0,0.35)";
          ctx.stroke(path);
        }
        ctx.save();
        ctx.translate(1, 1);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        for (const path of paths) ctx.stroke(path);
        ctx.restore();
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        canvas.className = "rounded-xl";
        previewRef.current.replaceChildren(canvas);
      } finally {
        if (alive) setRendering(false);
      }
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [res, rows, cols, p.style, p.shape, p.detail, paletteId, p.colorCount, p.dithering, p.brightness, p.contrast, p.saturation]);

  const set = <K extends keyof Prefs>(key: K, v: Prefs[K]) => {
    const next = { ...p, [key]: v };
    setP(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  function start() {
    if (!source || !res) return;
    const config: GameConfig = {
      source, title: res.title, aspect: `${cols}:${rows}`, pieces: rows * cols, rows, cols, shape: p.shape, mode: p.mode, preview,
      style: p.style, detail: p.detail, paletteId, colorCount: p.colorCount, dithering: p.dithering, brightness: p.brightness, contrast: p.contrast,
      saturation: p.saturation, focusX: res.focusX, focusY: res.focusY,
    };
    saveConfig(config);
    router.push("/play");
  }

  if (!source) return <p className="mt-8 text-center">{t("noSource")}</p>;
  if (error)
    return (
      <div className="card mx-auto mt-8 max-w-lg p-6 text-center">
        <p className="font-semibold">{t(`error.${error}`)}</p>
        {error === "missing-library-image" && <pre className="mt-3 rounded bg-black/5 p-2 text-xs">npm run library:fetch</pre>}
      </div>
    );

  const art = source.kind === "library" ? getArtwork(source.id) : undefined;
  const big = p.pieces > (p.shape === "jigsaw" ? 64 : 100);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
      <div>
        <h1 className="text-2xl font-extrabold">{res ? tx(res.title) : "…"}</h1>
        {art && <p className="text-sm muted">{art.artist} · {art.year} · {tx(art.museum)}</p>}
        <div ref={previewRef} className={`mt-3 overflow-hidden rounded-xl ${rendering ? "opacity-60" : ""}`} style={{ aspectRatio: `${cols} / ${rows}`, background: "var(--surface-2)" }} />
        <p className="mt-2 text-xs muted">
          {p.style === "photo" ? t("gridInfoPhoto", { rows, cols, pieces: rows * cols }) : t("gridInfo", { rows, cols, pieces: rows * cols, w: cols * k, h: rows * k })}
        </p>
        {art && <p className="mt-3 text-sm">💡 {tx(art.funFact)}</p>}
      </div>

      <div className="space-y-5">
        <Field label={t("pieces")}>
          {PIECE_OPTIONS.map((n) => (
            <button key={n} className="chip" aria-pressed={p.pieces === n} onClick={() => set("pieces", n)}>{n}</button>
          ))}
          {big && <p className="w-full text-xs muted">{t("bigWarning")}</p>}
        </Field>
        <Field label={t("shape")}>
          {SHAPES.map((s) => (
            <button key={s} className="chip" aria-pressed={p.shape === s} onClick={() => set("shape", s)}>{t(`shapes.${s}`)}</button>
          ))}
        </Field>
        <Field label={t("style")}>
          {ART_STYLES.map((st) => (
            <button key={st} className="chip" aria-pressed={p.style === st} onClick={() => set("style", st)}>{t(`styles.${st}`)}</button>
          ))}
        </Field>
        <Field label={t("mode")}>
          {MODES.map((m) => (
            <button key={m} className="chip" aria-pressed={p.mode === m} onClick={() => set("mode", m)}>{t(`modes.${m}`)}</button>
          ))}
          <p className="w-full text-xs muted">{t(`modeHelp.${p.mode}`)}</p>
        </Field>
        <Field label={t("preview")}>
          {rules.previewOptions.map((o) => (
            <button key={o} className="chip" aria-pressed={preview === o} onClick={() => set("preview", o)}>{t(`previews.${o}`)}</button>
          ))}
          {preview === "hold" && rules.peekPenaltyMs > 0 && (
            <p className="w-full text-xs muted">{t("peekPenalty", { s: rules.peekPenaltyMs / 1000 })}</p>
          )}
        </Field>
        <details className="card p-3">
          <summary className="cursor-pointer font-semibold">{p.style === "photo" ? t("advancedPhoto") : t("advanced")}</summary>
          <div className="mt-3 space-y-4">
            {p.style !== "photo" && (
              <>
                <Field label={p.style === "pixel" ? t("detailPixel") : t("detail")}>
                  {DETAIL_OPTIONS.map((d) => (
                    <button key={d} className="chip" aria-pressed={p.detail === d} onClick={() => set("detail", d)}>{d}</button>
                  ))}
                </Field>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">{t("palette")}</span>
                  <select className="select" value={paletteId} onChange={(e) => set("paletteId", e.target.value)}>
                    {p.style === "pixel" && <option value={AUTO_PALETTE_ID}>{t("paletteAuto")}</option>}
                    {PALETTES.map((pl) => <option key={pl.id} value={pl.id}>{tx(pl.name)}</option>)}
                  </select>
                </label>
                {p.style === "pixel" && paletteId === AUTO_PALETTE_ID && (
                  <Field label={t("colorCount")}>
                    {AUTO_COLOR_OPTIONS.map((n) => (
                      <button key={n} className="chip" aria-pressed={p.colorCount === n} onClick={() => set("colorCount", n)}>{n}</button>
                    ))}
                  </Field>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={p.dithering} onChange={(e) => set("dithering", e.target.checked)} /> {t("dithering")}
                </label>
              </>
            )}
            {(["brightness", "contrast", "saturation"] as const).map((key) => (
              <label key={key} className="block text-sm">
                <span className="font-semibold">{t(key)}</span>
                <input type="range" min={-0.5} max={0.5} step={0.05} value={p[key]} className="w-full" onChange={(e) => set(key, Number(e.target.value))} />
              </label>
            ))}
          </div>
        </details>
        <button className="btn btn-primary w-full text-lg" disabled={!res} onClick={start}>{t("start")}</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
