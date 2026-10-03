export const LOCALES = ["en", "vi"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";
export const LOCALE_COOKIE = "legart-locale";

export function pickLocale(cookie: string | undefined, acceptLanguage: string | null): AppLocale {
  if (cookie && (LOCALES as readonly string[]).includes(cookie)) return cookie as AppLocale;
  const langs = (acceptLanguage ?? "").toLowerCase().split(",").map((s) => s.trim().slice(0, 2));
  for (const l of langs) if ((LOCALES as readonly string[]).includes(l)) return l as AppLocale;
  return DEFAULT_LOCALE;
}
