"use client";
import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useApp } from "../Providers";
import { useL10n } from "../useL10n";
import { formatTime } from "@/lib/puzzle/scoring";
import type { AttemptRecord } from "@/lib/db/local";
import type { GameConfig, StoredMosaic } from "@/lib/game-config";
import type { QuizQuestion } from "@/content/types";
import { drawShareCard, shareOrDownload } from "./shareCard";

export interface ServerResult {
  status: "ranked" | "unranked" | "flagged";
  rank?: number | null;
  reason?: string | null;
}

interface Props {
  config: GameConfig;
  record: AttemptRecord;
  prevBest: number | null;
  server: ServerResult | null;
  attemptId: string | null;
  artCanvas: HTMLCanvasElement;
  storedMosaic: StoredMosaic | null;
  /** reference image, used as the challenge picture for the player's own photos */
  imageUrl: string;
  onPlayAgain: () => void;
}

async function imageToDataUrl(url: string, max = 1024): Promise<string> {
  const bmp = await createImageBitmap(await (await fetch(url)).blob());
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(b);
  });

export function Result({ config, record, prevBest, server, attemptId, artCanvas, storedMosaic, imageUrl, onPlayAgain }: Props) {
  const t = useTranslations("result");
  const tg = useTranslations("setup");
  const tx = useL10n();
  const locale = useLocale();
  const { user, config: app, api } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [challengeUrl, setChallengeUrl] = useState<string | null>(config.challenge ? `/c/${config.challenge.code}` : null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState({ question: "", a: "", b: "", c: "", d: "" });
  const isRecord = prevBest === null || record.totalMs < prevBest;
  const canCloud = app.backend && !!user && !!attemptId && server && server.status !== "flagged";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const absolute = (p: string) => (p.startsWith("http") ? p : origin + p);
  const ownImage = config.source.kind === "local" || config.source.kind === "cloud";

  const title = tx(config.title) || t("myPicture");
  const statsLines = [
    `${config.rows * config.cols} ${t("pieces")} · ${tg(`shapes.${config.shape}`)} · ${tg(`modes.${config.mode}`)}`,
    `${t("moves")}: ${record.moves}${record.quizTotal ? ` · ${t("quiz")}: ${record.quizCorrect}/${record.quizTotal}` : ""}`,
    `${t("score")}: ${record.score.toLocaleString(locale)}`,
  ];

  async function card(format: "post" | "story") {
    return drawShareCard(
      {
        mosaic: artCanvas, title, subtitle: t("cardSubtitle"), time: formatTime(record.totalMs), stats: statsLines,
        player: (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || t("guest"),
        url: absolute(challengeUrl ?? shareUrl ?? "/"), brandLine: "Legart",
      },
      format,
    );
  }

  async function shareImage(format: "post" | "story") {
    setBusy(format);
    try {
      const blob = await card(format);
      const r = await shareOrDownload(blob, `legart-${format}.png`, t("shareText", { title, time: formatTime(record.totalMs) }), absolute(challengeUrl ?? shareUrl ?? "/"));
      if (r === "downloaded") setMsg(t("downloaded"));
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!attemptId) return;
    setBusy("publish");
    setMsg(null);
    try {
      const blob = await card("post");
      const res = await api("/api/shares", { method: "POST", body: JSON.stringify({ attemptId, imageDataUrl: await blobToDataUrl(blob), locale }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setShareUrl(j.url);
    } catch (e) {
      setMsg(`${t("error")} ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function createChallenge() {
    if (!attemptId) return;
    setBusy("challenge");
    setMsg(null);
    try {
      const questions: QuizQuestion[] =
        q.question && q.a && q.b && q.c && q.d
          ? [{
              id: "custom-1",
              question: { en: q.question, vi: q.question },
              options: [q.a, q.b, q.c, q.d].map((s) => ({ en: s, vi: s })) as QuizQuestion["options"],
              explain: { en: "", vi: "" },
            }]
          : [];
      const res = await api("/api/challenges", {
        method: "POST",
        body: JSON.stringify({
          attemptId, style: config.style, mosaic: storedMosaic, title: config.title, questions,
          imageDataUrl: ownImage ? await imageToDataUrl(imageUrl) : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setChallengeUrl(`/c/${j.code}`);
    } catch (e) {
      setMsg(`${t("error")} ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  const link = shareUrl ?? challengeUrl;

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 p-4">
      <div className="card p-5 text-center animate-pop">
        <div className="text-sm font-semibold muted">{title}</div>
        <div className="mt-1 text-5xl font-black tabular-nums" style={{ color: "var(--accent)" }}>{formatTime(record.totalMs)}</div>
        {record.penaltyMs > 0 && <div className="text-xs muted">{t("penalty", { time: formatTime(record.penaltyMs) })}</div>}
        {isRecord && <div className="mt-2 inline-block rounded-full px-3 py-1 text-sm font-bold" style={{ background: "#f2cd37", color: "#1b2a34" }}>🏆 {t("newRecord")}</div>}
        <div className="mt-3 space-y-0.5 text-sm">{statsLines.map((s) => <div key={s}>{s}</div>)}</div>
        {server?.status === "ranked" && server.rank ? <div className="mt-2 font-semibold">{t("rank", { rank: server.rank })}</div> : null}
        {server?.status === "unranked" && <div className="mt-2 text-xs muted">{t("unranked")}</div>}
        {server?.status === "flagged" && <div className="mt-2 text-xs muted">{t("flagged")}</div>}
        {!server && app.backend && !user && <div className="mt-2 text-xs muted">{t("loginToRank")}</div>}
      </div>

      <div className="card space-y-2 p-4">
        <div className="font-semibold">{t("share")}</div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" disabled={!!busy} onClick={() => shareImage("post")}>{busy === "post" ? "…" : t("sharePost")}</button>
          <button className="btn" disabled={!!busy} onClick={() => shareImage("story")}>{busy === "story" ? "…" : t("shareStory")}</button>
        </div>
        {canCloud && !shareUrl && (
          <button className="btn w-full" disabled={!!busy} onClick={publish}>{busy === "publish" ? "…" : t("publish")}</button>
        )}
        {link && (
          <div className="space-y-2">
            <input className="input text-sm" readOnly value={absolute(link)} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(absolute(link)).then(() => setMsg(t("copied")))}>{t("copy")}</button>
              <a className="btn btn-sm" target="_blank" rel="noopener" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(absolute(link))}`}>Facebook</a>
              <a className="btn btn-sm" target="_blank" rel="noopener" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(absolute(link))}&text=${encodeURIComponent(t("shareText", { title, time: formatTime(record.totalMs) }))}`}>X</a>
            </div>
          </div>
        )}
        {msg && <p className="text-sm muted">{msg}</p>}
      </div>

      {canCloud && !challengeUrl && (
        <div className="card space-y-2 p-4">
          <div className="font-semibold">{t("challengeTitle")}</div>
          <p className="text-sm muted">{t("challengeHelp")}</p>
          {ownImage && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold">{t("customQuestion")}</summary>
              <div className="mt-2 space-y-2">
                <input className="input" maxLength={140} placeholder={t("qQuestion")} value={q.question} onChange={(e) => setQ({ ...q, question: e.target.value })} />
                <input className="input" maxLength={60} placeholder={t("qCorrect")} value={q.a} onChange={(e) => setQ({ ...q, a: e.target.value })} />
                {(["b", "c", "d"] as const).map((k) => (
                  <input key={k} className="input" maxLength={60} placeholder={t("qWrong")} value={q[k]} onChange={(e) => setQ({ ...q, [k]: e.target.value })} />
                ))}
              </div>
            </details>
          )}
          <button className="btn btn-primary w-full" disabled={!!busy} onClick={createChallenge}>{busy === "challenge" ? "…" : t("createChallenge")}</button>
        </div>
      )}
      {challengeUrl && (
        <Link href={challengeUrl} className="btn w-full">{t("viewChallenge")}</Link>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-primary" onClick={onPlayAgain}>{t("again")}</button>
        <Link href="/library" className="btn">{t("other")}</Link>
      </div>
    </div>
  );
}
