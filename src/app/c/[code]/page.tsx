import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { backendEnabled } from "@/lib/config";
import { challengeBoard, challengeImageUrl, getChallenge } from "@/lib/server/data";
import { formatTime } from "@/lib/puzzle/scoring";
import { PlayChallenge } from "@/components/PlayChallenge";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const t = await getTranslations("challenge");
  const c = backendEnabled() ? await getChallenge(code.toUpperCase()) : null;
  const locale = (await getLocale()) as "en" | "vi";
  if (!c) return { title: t("title") };
  const img = challengeImageUrl(c);
  return {
    title: `${t("title")} · ${c.title[locale]}`,
    description: t("ogDescription", { title: c.title[locale], pieces: c.rows * c.cols }),
    openGraph: img ? { images: [img] } : undefined,
  };
}

export default async function ChallengePage({ params }: Props) {
  const { code } = await params;
  const t = await getTranslations("challenge");
  const ts = await getTranslations("setup");
  const locale = (await getLocale()) as "en" | "vi";
  if (!backendEnabled()) return <p className="mt-10 text-center">{t("noBackend")}</p>;
  const c = await getChallenge(code.toUpperCase());
  if (!c) notFound();
  const board = await challengeBoard(c.id);
  const expired = c.expires_at ? new Date(c.expires_at) < new Date() : false;
  const img = challengeImageUrl(c);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--accent)" }}>{t("title")} · {c.code}</div>
      <h1 className="text-2xl font-extrabold">{c.title[locale] || t("untitled")}</h1>
      <p className="text-sm muted">
        {c.rows * c.cols} {t("pieces")} · {ts(`shapes.${c.shape}`)} · {ts(`modes.${c.mode}`)} · {ts(`previews.${c.preview}`)}
      </p>
      {img && <img src={img} alt="" className="max-h-72 w-full rounded-xl object-contain" style={{ background: "var(--surface-2)" }} />}
      {expired ? (
        <p className="card p-4 text-center font-semibold">{t("expired")}</p>
      ) : (
        <PlayChallenge
          challenge={{
            code: c.code, title: c.title, artworkId: c.artwork_id, imageUrl: img, rows: c.rows, cols: c.cols, shape: c.shape,
            mode: c.mode, preview: c.preview, seed: Number(c.seed), mosaic: c.mosaic, questions: c.questions,
          }}
        />
      )}
      <section className="card p-4">
        <h2 className="font-bold">{t("leaderboard")}</h2>
        {board.length === 0 ? (
          <p className="mt-2 text-sm muted">{t("empty")}</p>
        ) : (
          <ol className="mt-2 divide-y" style={{ borderColor: "var(--border)" }}>
            {board.map((e, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <span className="w-6 text-right font-bold">{i + 1}</span>
                <span className="flex-1 truncate">{e.name}{e.isGuest ? ` (${t("guest")})` : ""}</span>
                <span className="font-mono tabular-nums">{formatTime(e.totalMs)}</span>
              </li>
            ))}
          </ol>
        )}
        {c.expires_at && !expired && <p className="mt-2 text-xs muted">{t("expires", { date: new Date(c.expires_at).toLocaleDateString(locale) })}</p>}
      </section>
    </div>
  );
}
