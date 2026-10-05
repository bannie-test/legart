import { getTranslations } from "next-intl/server";

export const metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const items = ["local", "cloud", "public", "delete", "analytics"] as const;
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      {items.map((k) => <p key={k} className="text-sm">{t(k)}</p>)}
    </div>
  );
}
