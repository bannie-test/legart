"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "./Providers";
import { saveConfig, type StoredMosaic } from "@/lib/game-config";
import { DEFAULT_DETAIL } from "@/lib/puzzle/types";
import type { Mode, PreviewPolicy, Shape } from "@/lib/puzzle/types";
import type { L10n, QuizQuestion } from "@/content/types";

export interface ChallengeInfo {
  code: string;
  title: L10n;
  artworkId: string | null;
  imageUrl: string | null;
  rows: number;
  cols: number;
  shape: Shape;
  mode: Mode;
  preview: PreviewPolicy;
  seed: number;
  mosaic: StoredMosaic;
  questions: QuizQuestion[];
}

const NICKNAME_KEY = "legart:nickname";

export function PlayChallenge({ challenge: c }: { challenge: ChallengeInfo }) {
  const t = useTranslations("challenge");
  const router = useRouter();
  const { user } = useApp();
  const [nick, setNick] = useState("");
  useEffect(() => setNick(localStorage.getItem(NICKNAME_KEY) ?? ""), []);

  function play() {
    if (!user) localStorage.setItem(NICKNAME_KEY, nick.trim().slice(0, 24) || "Guest");
    saveConfig({
      source: { kind: "challenge", code: c.code },
      title: c.title,
      aspect: `${c.mosaic.width}:${c.mosaic.height}`,
      pieces: c.rows * c.cols, rows: c.rows, cols: c.cols, shape: c.shape, mode: c.mode, preview: c.preview,
      detail: DEFAULT_DETAIL, paletteId: c.mosaic.paletteId, dithering: false, brightness: 0, contrast: 0, saturation: 0,
      focusX: 0.5, focusY: 0.5,
      challenge: { code: c.code, seed: c.seed, mosaic: c.mosaic, imageUrl: c.imageUrl, artworkId: c.artworkId, questions: c.questions },
    });
    router.push("/play");
  }

  return (
    <div className="card space-y-3 p-4">
      {!user && (
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t("nickname")}</span>
          <input className="input" maxLength={24} value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Guest" />
          <span className="mt-1 block text-xs muted">{t("guestNote")}</span>
        </label>
      )}
      <button className="btn btn-primary w-full text-lg" onClick={play}>{t("play")}</button>
    </div>
  );
}
