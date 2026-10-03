"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { db, type SavedGame } from "@/lib/db/local";
import { saveConfig } from "@/lib/game-config";
import { useL10n } from "./useL10n";

export function ContinueGame() {
  const t = useTranslations("home");
  const tx = useL10n();
  const router = useRouter();
  const [saved, setSaved] = useState<SavedGame | null>(null);
  useEffect(() => {
    db.saved.get("current").then((s) => setSaved(s ?? null)).catch(() => {});
  }, []);
  if (!saved || saved.state.solved) return null;
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="flex-1">
        <div className="font-semibold">{t("continueTitle")}</div>
        <div className="text-sm muted">{tx(saved.config.title)} · {saved.config.rows * saved.config.cols} · {saved.config.shape}</div>
      </div>
      <button
        className="btn btn-primary"
        onClick={() => {
          saveConfig(saved.config);
          router.push("/play?resume=1");
        }}
      >
        {t("continue")}
      </button>
    </div>
  );
}

export function JoinChallenge() {
  const t = useTranslations("home");
  const [code, setCode] = useState("");
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (
    <section className="card p-4">
      <h2 className="font-bold">{t("joinTitle")}</h2>
      <p className="text-sm muted">{t("joinHint")}</p>
      <form className="mt-3 flex gap-2" onSubmit={(e) => e.preventDefault()}>
        <input className="input uppercase tracking-widest" maxLength={8} placeholder="AB12CD" value={code} onChange={(e) => setCode(e.target.value)} aria-label={t("joinTitle")} />
        <Link href={clean.length >= 4 ? `/c/${clean}` : "#"} className={`btn btn-primary ${clean.length < 4 ? "pointer-events-none opacity-50" : ""}`}>
          {t("join")}
        </Link>
      </form>
    </section>
  );
}
