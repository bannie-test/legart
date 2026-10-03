import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ARTWORKS, libraryThumb } from "@/content/artworks";
import { ArtThumb } from "@/components/ArtThumb";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("library");
  return { title: t("title") };
}

export default async function LibraryPage() {
  const t = await getTranslations("library");
  const locale = (await getLocale()) as "en" | "vi";
  return (
    <div>
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="muted mt-1 text-sm">{t("subtitle")}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ARTWORKS.map((a) => (
          <Link key={a.id} href={`/setup?src=library:${a.id}`} className="card overflow-hidden">
            <ArtThumb src={libraryThumb(a.id)} alt={a.title[locale]} className="aspect-[4/5] w-full" />
            <div className="p-3">
              <div className="font-semibold leading-tight">{a.title[locale]}</div>
              <div className="mt-0.5 text-xs muted">{a.artist} · {a.year}</div>
              <div className="mt-2 text-xs font-semibold" style={{ color: "var(--accent)" }}>{t(`difficulty.${a.difficulty}`)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
