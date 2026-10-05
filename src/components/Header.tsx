"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useApp } from "./Providers";
import { LOCALE_COOKIE } from "@/i18n/config";

export function Header() {
  const t = useTranslations("nav");
  const path = usePathname();
  const { user, config } = useApp();
  const nav = [
    { href: "/library", label: t("library") },
    { href: "/upload", label: t("upload") },
    ...(config.backend ? [{ href: "/leaderboard", label: t("leaderboard") }] : []),
    { href: "/me", label: t("me") },
  ];
  if (path === "/play") return null; // the game uses the whole screen
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3">
      <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight text-lg">
        <img src="/icon.svg" alt="" width={28} height={28} />
        Legart
      </Link>
      <nav className="ml-auto hidden gap-1 sm:flex">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={`btn btn-ghost btn-sm ${path.startsWith(n.href) ? "underline" : ""}`}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1 sm:ml-2">
        <LanguageSwitch />
        {config.supabaseUrl &&
          (user ? (
            <Link href="/me" className="btn btn-sm" aria-label={t("me")}>
              {(user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Me"}
            </Link>
          ) : (
            <Link href="/login" className="btn btn-sm btn-primary">{t("login")}</Link>
          ))}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t sm:hidden" style={{ background: "var(--surface)", borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={`flex-1 py-3 text-center text-sm font-semibold ${path.startsWith(n.href) ? "" : "muted"}`}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function LanguageSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const next = locale === "en" ? "vi" : "en";
  return (
    <button
      className="btn btn-sm"
      aria-label="Language / Ngôn ngữ"
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      {locale === "en" ? "EN · vi" : "VI · en"}
    </button>
  );
}
