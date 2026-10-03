import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { backendEnabled } from "@/lib/config";
import { getShare } from "@/lib/server/data";
import { publicStorageUrl } from "@/lib/supabase/server";
import { formatTime } from "@/lib/puzzle/scoring";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = backendEnabled() ? await getShare(id) : null;
  if (!s?.attempts) return { title: "Legart" };
  const t = await getTranslations({ locale: s.locale, namespace: "sharePage" });
  const a = s.attempts;
  const name = a.profiles?.display_name ?? a.guest_name ?? "Player";
  const title = t("ogTitle", { name, time: formatTime(a.total_ms) });
  const description = t("ogDescription", { title: a.title[s.locale as "en" | "vi"] ?? a.title.en, pieces: a.pieces });
  const image = publicStorageUrl(s.image_path);
  return { title, description, openGraph: { title, description, images: [image] }, twitter: { card: "summary_large_image", images: [image] } };
}

export default async function SharePage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("sharePage");
  const locale = (await getLocale()) as "en" | "vi";
  if (!backendEnabled()) notFound();
  const s = await getShare(id);
  if (!s?.attempts) notFound();
  const a = s.attempts;
  const cta = a.challenges?.code ? `/c/${a.challenges.code}` : a.artwork_id ? `/setup?src=library:${a.artwork_id}` : "/library";
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <img src={publicStorageUrl(s.image_path)} alt={a.title[locale]} className="w-full rounded-2xl" />
      <p className="text-lg font-semibold">{t("headline", { name: a.profiles?.display_name ?? a.guest_name ?? "Player", time: formatTime(a.total_ms) })}</p>
      <Link href={cta} className="btn btn-primary w-full text-lg">{a.challenges?.code ? t("acceptChallenge") : t("tryIt")}</Link>
    </div>
  );
}
