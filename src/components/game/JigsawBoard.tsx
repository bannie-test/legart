"use client";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  JIGSAW_PAD,
  TABLE_MARGIN,
  type JigsawState,
} from "@/lib/puzzle/jigsaw";
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

export function JigsawBoard({
  state,
  art,
  rules,
  ghostUrl,
  area,
  onAction,
  apiRef,
}: Props) {
  const u = art.size;
  const tableW = (state.cols + 2 * M) * u;
  const tableH = (state.rows + 2 * M) * u;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ s: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [drag, setDrag] = useState<{
    group: number;
    dx: number;
    dy: number;
  } | null>(null);
  const zRef = useRef<Record<number, number>>({});
  const zCounter = useRef(1);

  const fitScale = Math.min(area.w / tableW, area.h / tableH) * 0.98;
  const fit = useCallback(() => {
    setView({
      s: fitScale,
      tx: (area.w - tableW * fitScale) / 2,
      ty: (area.h - tableH * fitScale) / 2,
    });
  }, [fitScale, area.w, area.h, tableW, tableH]);
  useEffect(() => fit(), [fit]);

  useImperativeHandle(
    apiRef,
    () => ({
      clientToPiece(x, y) {
        const el = viewportRef.current;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
        const v = viewRef.current;
        return {
          x: (x - r.left - v.tx) / (v.s * u) - M - 0.5,
          y: (y - r.top - v.ty) / (v.s * u) - M - 0.5,
        };
      },
    }),
    [u],
  );

  // ---- dragging pieces on the table ----
  function onPieceDown(e: React.PointerEvent, i: number) {
    e.stopPropagation();
    const p = state.pieces[i];
    const group = p.group;
    const sx = e.clientX,
      sy = e.clientY;
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
        if (target?.closest("[data-tray]"))
          onAction({ type: "tray", piece: i });
        else
          onAction({
            type: "drop",
            piece: i,
            x: p.x + (x - sx) / s,
            y: p.y + (y - sy) / s,
          });
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
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: tableW,
          height: tableH,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`,
        }}
      >
        <div
          data-board
          className="absolute"
          style={{
            left: M * u,
            top: M * u,
            width: state.cols * u,
            height: state.rows * u,
            background: "var(--surface-2)",
            outline:
              rules.grid !== "none" ? "3px solid var(--border)" : undefined,
            backgroundImage:
              rules.grid === "full"
                ? `linear-gradient(rgba(127,127,127,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(127,127,127,.25) 1px, transparent 1px)`
                : undefined,
            backgroundSize: rules.grid === "full" ? `${u}px ${u}px` : undefined,
          }}
        >
          {rules.ghost && ghostUrl && (
            <img
              src={ghostUrl}
              alt=""
              className="pointer-events-none h-full w-full opacity-25"
            />
          )}
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
    </div>
  );
}
