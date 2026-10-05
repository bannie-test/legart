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
    <div className="space-y-8 py-4">
      <section
        className="studs-bg relative overflow-hidden border-[3px] border-[#2d2d2d] p-6 text-[#2d2d2d] shadow-[8px_8px_0px_0px_#2d2d2d] sm:p-10"
        style={{
          borderRadius: "255px 15px 225px 15px / 15px 225px 15px 255px",
        }}
      >
        <div
          className="relative z-10 max-w-xl rounded-[2rem] border-[3px] border-[#2d2d2d] bg-[#fffaf3]/80 p-5 backdrop-blur-[2px]"
          style={{
            borderRadius: "255px 25px 215px 25px / 15px 220px 15px 240px",
          }}
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border-[2px] border-[#2d2d2d] bg-[#fff9c4] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#2d2d2d]">
            creative playground
          </div>
          <h1 className="text-3xl leading-tight text-[#2d2d2d] sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-lg text-base text-[#2d2d2d]/80 sm:text-xl">
            {t("subtitle")}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/library"
              className="btn btn-secondary"
              style={{ background: "#fff", color: "#2d2d2d" }}
            >
              {t("ctaLibrary")}
            </Link>
            <Link
              href="/upload"
              className="btn"
              style={{
                background: "#fff9c4",
                color: "#2d2d2d",
                borderColor: "#2d2d2d",
              }}
            >
              {t("ctaUpload")}
            </Link>
          </div>
        </div>
      </section>

      <ContinueGame />

      <section>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-2xl text-[#2d2d2d]">{t("featured")}</h2>
          <Link
            href="/library"
            className="text-sm font-bold underline decoration-2 underline-offset-4"
          >
            {t("seeAll")}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {featured.map((a, index) => (
            <Link
              key={a.id}
              href={`/setup?src=library:${a.id}`}
              className={`card overflow-hidden ${index % 2 === 0 ? "-rotate-1" : "rotate-1"}`}
            >
              <ArtThumb
                src={libraryThumb(a.id)}
                alt={a.title[locale]}
                className="aspect-square w-full"
              />
              <div className="border-t-[3px] border-[#2d2d2d] bg-[#fffefb] p-3 text-sm font-bold text-[#2d2d2d]">
                {a.title[locale]}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {backendEnabled() && <JoinChallenge />}

      <section className="grid gap-4 sm:grid-cols-3">
        {(["how1", "how2", "how3"] as const).map((k, i) => (
          <div
            key={k}
            className="card p-4"
            style={{
              transform:
                i === 1 ? "rotate(1deg)" : i === 2 ? "rotate(-1deg)" : "none",
            }}
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-[#2d2d2d] bg-[#fff9c4] text-xl font-bold text-[#2d2d2d]">
              {i + 1}
            </div>
            <p className="text-base leading-relaxed">{t(k)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
