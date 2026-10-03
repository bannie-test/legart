"use client";
import { useLocale } from "next-intl";
import type { L10n } from "@/content/types";

export function useL10n() {
  const locale = useLocale() as "en" | "vi";
  return (v: L10n | string | undefined | null) => (v == null ? "" : typeof v === "string" ? v : v[locale] ?? v.en);
}
