"use client";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { useTranslations } from "next-intl";
import { JIGSAW_PAD, TABLE_MARGIN, type JigsawState } from "@/lib/puzzle/jigsaw";
import type { ModeRules } from "@/lib/puzzle/modes";
import type { JigsawAction } from "@/lib/puzzle/types";
import { trackPointer } from "./drag";
import type { PieceArt } from "./pieces";

export interface JigsawApi {
  /** Converts a screen point to the board position of a piece centred under it, or null when outside the table. */
  clientToPiece(x: number, y: number): { x: number; y: number } | null;
}

interface Props {
  state: JigsawState;
  art: PieceArt;
  rules: ModeRules;
  ghostUrl: string | null;
  area: { w: number; h: number };
  onAction: (a: JigsawAction) => void;
  apiRef: Ref<JigsawApi>;
}

interface View {
  s: number;
  tx: number;
  ty: number;
}

const M = TABLE_MARGIN;

export function JigsawBoard({ state, art, rules, ghostUrl, area, onAction, apiRef }: Props) {
  const t = useTranslations("game");
  const u = art.size;
  const tableW = (state.cols + 2 * M) * u;
  const tableH = (state.rows + 2 * M) * u;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ s: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [drag, setDrag] = useState<{ group: number; dx: number; dy: number } | null>(null);
  const zRef = useRef<Record<number, number>>({});
  const zCounter = useRef(1);

  const fitScale = Math.min(area.w / tableW, area.h / tableH) * 0.98;
  const fit = useCallback(() => {
    setView({ s: fitScale, tx: (area.w - tableW * fitScale) / 2, ty: (area.h - tableH * fitScale) / 2 });
  }, [fitScale, area.w, area.h, tableW, tableH]);
  useEffect(() => fit(), [fit]);

  useImperativeHandle(apiRef, () => ({
    clientToPiece(x, y) {
      const el = viewportRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
      const v = viewRef.current;
      return { x: (x - r.left - v.tx) / (v.s * u) - M - 0.5, y: (y - r.top - v.ty) / (v.s * u) - M - 0.5 };
    },
  }), [u]);

  // ---- pan & pinch on the table background ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ v: View; pts: { x: number; y: number }[] } | null>(null);
  const snapshot = () => {
    gesture.current = { v: viewRef.current, pts: [...pointers.current.values()] };
  };
  const clampScale = (s: number) => Math.max(fitScale * 0.6, Math.min(fitScale * 6, s));

  function onBgDown(e: React.PointerEvent) {
    viewportRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    snapshot();
  }
  function onBgMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length === 1 && g.pts.length === 1) {
      setView({ ...g.v, tx: g.v.tx + pts[0].x - g.pts[0].x, ty: g.v.ty + pts[0].y - g.pts[0].y });
    } else if (pts.length >= 2 && g.pts.length >= 2) {
      const c0 = { x: (g.pts[0].x + g.pts[1].x) / 2, y: (g.pts[0].y + g.pts[1].y) / 2 };
      const c1 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const d0 = Math.hypot(g.pts[0].x - g.pts[1].x, g.pts[0].y - g.pts[1].y) || 1;
      const d1 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const s = clampScale(g.v.s * (d1 / d0));
      const r = viewportRef.current!.getBoundingClientRect();
      const ax = c0.x - r.left, ay = c0.y - r.top;
      setView({ s, tx: c1.x - r.left - (ax - g.v.tx) * (s / g.v.s), ty: c1.y - r.top - (ay - g.v.ty) * (s / g.v.s) });
    }
  }
  function onBgUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    snapshot();
  }
  function zoomAt(factor: number, cx?: number, cy?: number) {
    const v = viewRef.current;
    const s = clampScale(v.s * factor);
    const ax = cx ?? area.w / 2, ay = cy ?? area.h / 2;
    setView({ s, tx: ax - (ax - v.tx) * (s / v.s), ty: ay - (ay - v.ty) * (s / v.s) });
  }

  // ---- dragging pieces on the table ----
  function onPieceDown(e: React.PointerEvent, i: number) {
    e.stopPropagation();
    const p = state.pieces[i];
    const group = p.group;
    const sx = e.clientX, sy = e.clientY;
    zRef.current[group] = ++zCounter.current;
    trackPointer(e, {
      onTap: () => onAction({ type: "rotate", piece: i }),
      onMove: (x, y) => {
        const s = viewRef.current.s * u;
        setDrag({ group, dx: (x - sx) / s, dy: (y - sy) / s });
      },
      onDrop: (x, y, target) => {
        const s = viewRef.current.s * u;
        setDrag(null);
        if (target?.closest("[data-tray]")) onAction({ type: "tray", piece: i });
        else onAction({ type: "drop", piece: i, x: p.x + (x - sx) / s, y: p.y + (y - sy) / s });
      },
      onCancel: () => setDrag(null),
    });
  }

  const pad = JIGSAW_PAD * u;
  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full overflow-hidden"
      style={{ touchAction: "none", background: "var(--table)" }}
      onPointerDown={onBgDown}
      onPointerMove={onBgMove}
      onPointerUp={onBgUp}
      onPointerCancel={onBgUp}
      onWheel={(e) => {
        const r = viewportRef.current!.getBoundingClientRect();
        zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: tableW, height: tableH, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` }}
      >
        <div
          data-board
          className="absolute"
          style={{
            left: M * u, top: M * u, width: state.cols * u, height: state.rows * u,
            background: "var(--surface-2)",
            outline: rules.grid !== "none" ? "3px solid var(--border)" : undefined,
            backgroundImage:
              rules.grid === "full"
                ? `linear-gradient(rgba(127,127,127,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(127,127,127,.25) 1px, transparent 1px)`
                : undefined,
            backgroundSize: rules.grid === "full" ? `${u}px ${u}px` : undefined,
          }}
        >
          {rules.ghost && ghostUrl && <img src={ghostUrl} alt="" className="pointer-events-none h-full w-full opacity-25" />}
        </div>
        {state.pieces.map((p, i) => {
          if (p.inTray) return null;
          const off = drag && drag.group === p.group ? drag : null;
          return (
            // the wrapper carries the drop shadow: a filter on the clipped <img> itself would be clipped away
            <div
              key={i}
              className="pointer-events-none absolute"
              style={{
                left: (p.x + M) * u - pad + (off ? off.dx * u : 0),
                top: (p.y + M) * u - pad + (off ? off.dy * u : 0),
                width: art.box,
                height: art.box,
                zIndex: p.locked ? 1 : 2 + (zRef.current[p.group] ?? 0),
                filter: p.locked
                  ? undefined
                  : off
                    ? `drop-shadow(0 ${u * 0.06}px ${u * 0.08}px rgba(0,0,0,.45))`
                    : `drop-shadow(0 ${u * 0.02}px ${u * 0.03}px rgba(0,0,0,.4))`,
              }}
            >
              <img
                src={art.urls[i]}
                alt=""
                draggable={false}
                className="h-full w-full select-none"
                style={{
                  transform: `rotate(${p.rot * 90}deg)`,
                  clipPath: `path('${art.paths[i]}')`,
                  pointerEvents: p.locked ? "none" : "auto",
                  cursor: "grab",
                }}
                onPointerDown={(e) => onPieceDown(e, i)}
              />
            </div>
          );
        })}
      </div>
      <div className="absolute bottom-2 right-2 flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
        <button className="btn btn-sm" aria-label={t("zoomOut")} onClick={() => zoomAt(1 / 1.25)}>−</button>
        <button className="btn btn-sm" aria-label={t("zoomFit")} onClick={fit}>⤢</button>
        <button className="btn btn-sm" aria-label={t("zoomIn")} onClick={() => zoomAt(1.25)}>+</button>
      </div>
    </div>
  );
}
