import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ARTWORKS, libraryThumb } from "@/content/artworks";
import { ArtThumb } from "@/components/ArtThumb";
import { ContinueGame, JoinChallenge } from "@/components/HomeWidgets";
import { backendEnabled } from "@/lib/config";

export default async function Home() {
  const t = await getTranslations("home");
  const locale = (await getLocale()) as "en" | "vi";
  const featured = ARTWORKS.slice(0, 6);
  return (
    <div className="space-y-8">
      <section className="studs-bg overflow-hidden rounded-3xl p-6 text-white sm:p-10">
        <div className="max-w-xl rounded-2xl bg-black/35 p-5 backdrop-blur-sm">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{t("title")}</h1>
          <p className="mt-2 text-white/90">{t("subtitle")}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/library" className="btn" style={{ background: "#fff", color: "#1b2a34" }}>{t("ctaLibrary")}</Link>
            <Link href="/upload" className="btn" style={{ background: "#f2cd37", color: "#1b2a34", borderColor: "#f2cd37" }}>{t("ctaUpload")}</Link>
          </div>
        </div>
      </section>

      <ContinueGame />

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">{t("featured")}</h2>
          <Link href="/library" className="text-sm underline">{t("seeAll")}</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {featured.map((a) => (
            <Link key={a.id} href={`/setup?src=library:${a.id}`} className="card overflow-hidden">
              <ArtThumb src={libraryThumb(a.id)} alt={a.title[locale]} className="aspect-square w-full" />
              <div className="p-2 text-sm font-semibold">{a.title[locale]}</div>
            </Link>
          ))}
        </div>
      </section>

      {backendEnabled() && <JoinChallenge />}

      <section className="grid gap-3 sm:grid-cols-3">
        {(["how1", "how2", "how3"] as const).map((k, i) => (
          <div key={k} className="card p-4">
            <div className="text-2xl font-black" style={{ color: "var(--accent)" }}>{i + 1}</div>
            <p className="mt-1 text-sm">{t(k)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
