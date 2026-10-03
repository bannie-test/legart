import { getLocale, getTranslations } from "next-intl/server";
import { ARTWORKS } from "@/content/artworks";

export const metadata = { title: "Credits" };

export default async function CreditsPage() {
  const t = await getTranslations("credits");
  const locale = (await getLocale()) as "en" | "vi";
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-sm">{t("intro")}</p>
      <ul className="space-y-2">
        {ARTWORKS.map((a) => (
          <li key={a.id} className="card p-3 text-sm">
            <div className="font-semibold">{a.title[locale]} — {a.artist}, {a.year}</div>
            <div className="muted">{a.museum[locale]}</div>
            <a className="underline" href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(a.commons)}`} target="_blank" rel="noopener">
              Wikimedia Commons · {t("license")}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs muted">{t("trademark")}</p>
    </div>
  );
}
