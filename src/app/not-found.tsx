import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="mt-16 text-center">
      <div className="text-5xl">🧩</div>
      <h1 className="mt-3 text-xl font-bold">{t("title")}</h1>
      <Link href="/" className="btn mt-4">{t("home")}</Link>
    </div>
  );
}
