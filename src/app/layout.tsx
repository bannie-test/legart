import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { backendEnabled, getPublicConfig } from "@/lib/config";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const tm = await getTranslations("meta");
  const site = process.env.SITE_URL;
  return {
    title: { default: "Legart", template: "%s · Legart" },
    description: tm("description"),
    metadataBase: site ? new URL(site) : undefined,
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icon.svg", apple: "/icon.svg" },
    appleWebApp: { capable: true, title: "Legart", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c91a09",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("footer");
  const cfg = getPublicConfig();
  return (
    <html lang={locale}>
      <body className="antialiased">
        <NextIntlClientProvider>
          <Providers config={{ ...cfg, backend: backendEnabled() }}>
            <Header />
            <main className="mx-auto w-full max-w-5xl px-4 pb-24 sm:pb-10">{children}</main>
            <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs muted">
              <p>{t("disclaimer")}</p>
              <p className="mt-1">
                <a className="underline" href="/credits">{t("credits")}</a> · <a className="underline" href="/privacy">{t("privacy")}</a>
              </p>
            </footer>
          </Providers>
        </NextIntlClientProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`,
          }}
        />
      </body>
    </html>
  );
}
