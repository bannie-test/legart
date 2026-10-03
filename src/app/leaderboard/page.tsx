"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/components/Providers";
import { useL10n } from "@/components/useL10n";
import { ARTWORKS } from "@/content/artworks";
import { formatTime } from "@/lib/puzzle/scoring";
import { MODES, PIECE_OPTIONS, SHAPES } from "@/lib/puzzle/types";

interface Entry { name: string; totalMs: number; createdAt: string; isGuest: boolean }

export default function LeaderboardPage() {
  const t = useTranslations("leaderboard");
  const ts = useTranslations("setup");
  const tx = useL10n();
  const { config } = useApp();
  const [f, setF] = useState({ artwork: ARTWORKS[0].id, pieces: 36, shape: "square", mode: "easy", preview: "none", period: "all" });
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!config.backend) return;
    setEntries(null);
    setErr(false);
    fetch(`/api/leaderboard?${new URLSearchParams({ ...f, pieces: String(f.pieces) })}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setEntries(j.entries))
      .catch(() => setErr(true));
  }, [f, config.backend]);

  if (!config.backend) return <p className="mt-10 text-center">{t("noBackend")}</p>;
  const sel = (key: keyof typeof f, options: { v: string; label: string }[]) => (
    <select className="select" value={String(f[key])} onChange={(e) => setF({ ...f, [key]: key === "pieces" ? Number(e.target.value) : e.target.value })}>
      {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  );
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3">{sel("artwork", ARTWORKS.map((a) => ({ v: a.id, label: tx(a.title) })))}</div>
        {sel("pieces", PIECE_OPTIONS.map((n) => ({ v: String(n), label: `${n} ${t("pieces")}` })))}
        {sel("shape", SHAPES.map((s) => ({ v: s, label: ts(`shapes.${s}`) })))}
        {sel("mode", MODES.map((m) => ({ v: m, label: ts(`modes.${m}`) })))}
        {sel("preview", [{ v: "none", label: t("noPreview") }, { v: "always", label: t("withPreview") }])}
        {sel("period", [{ v: "all", label: t("allTime") }, { v: "week", label: t("week") }])}
      </div>
      <div className="card p-4">
        {err && <p className="muted">{t("error")}</p>}
        {!err && entries === null && <p className="muted">…</p>}
        {entries?.length === 0 && <p className="muted">{t("empty")}</p>}
        {entries && entries.length > 0 && (
          <ol className="divide-y" style={{ borderColor: "var(--border)" }}>
            {entries.map((e, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <span className="w-6 text-right font-bold">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
                <span className="flex-1 truncate">{e.name}</span>
                <span className="font-mono tabular-nums">{formatTime(e.totalMs)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="text-xs muted">{t("rules")}</p>
    </div>
  );
}
