"use client";
import { useTranslations } from "next-intl";
import type { PieceArt } from "./pieces";

interface Props {
  ids: number[];
  art: PieceArt;
  rot: (i: number) => number;
  jigsaw: boolean;
  /** piece currently being dragged out of the tray (kept mounted so touch tracking survives) */
  dimmed: number | null;
  onPieceDown: (e: React.PointerEvent, piece: number, size: number) => void;
}

export function Tray({ ids, art, rot, jigsaw, dimmed, onPieceDown }: Props) {
  const t = useTranslations("game");
  const core = 58;
  const size = jigsaw ? Math.round((core * art.box) / art.size) : core;
  return (
    <div
      data-tray
      className="flex shrink-0 items-center gap-2 overflow-x-auto overflow-y-hidden border-t px-3"
      style={{ height: size + 22, borderColor: "var(--border)", background: "var(--surface)", touchAction: "pan-x" }}
      aria-label={t("tray")}
    >
      {ids.length === 0 && <span className="w-full text-center text-sm muted">{t("trayEmpty")}</span>}
      {ids.map((i) => (
        <img
          key={i}
          src={art.urls[i]}
          alt=""
          draggable={false}
          data-piece={i}
          className="shrink-0 select-none"
          style={{
            width: size, height: size, transform: `rotate(${rot(i) * 90}deg)`, touchAction: "pan-x",
            margin: jigsaw ? -size * 0.12 : 0, cursor: "grab", opacity: dimmed === i ? 0.2 : 1,
          }}
          onPointerDown={(e) => onPieceDown(e, i, size)}
        />
      ))}
    </div>
  );
}
