"use client";
import type { SquareState } from "@/lib/puzzle/square";
import type { ModeRules } from "@/lib/puzzle/modes";
import type { PieceArt } from "./pieces";

interface Props {
  state: SquareState;
  art: PieceArt;
  rules: ModeRules;
  ghostUrl: string | null;
  area: { w: number; h: number };
  hidden: number | null;
  onPieceDown: (e: React.PointerEvent, piece: number, size: number) => void;
}

export function SquareBoard({ state, art, rules, ghostUrl, area, hidden, onPieceDown }: Props) {
  const size = Math.max(16, Math.floor(Math.min((area.w - 8) / state.cols, (area.h - 8) / state.rows)));
  const w = size * state.cols;
  const h = size * state.rows;
  return (
    <div className="relative mx-auto" style={{ width: w, height: h, background: "var(--table)", borderRadius: 6, boxShadow: "inset 0 0 0 2px var(--border)" }}>
      {rules.ghost && ghostUrl && <img src={ghostUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full opacity-25" />}
      {state.cells.map((p, cell) => {
        const x = (cell % state.cols) * size;
        const y = Math.floor(cell / state.cols) * size;
        const locked = p !== null && state.locked[p];
        return (
          <div
            key={cell}
            data-cell={cell}
            className="absolute"
            style={{
              left: x, top: y, width: size, height: size,
              boxShadow: rules.grid === "full" ? "inset 0 0 0 1px rgba(127,127,127,0.25)" : undefined,
            }}
          >
            {p !== null && (
              <img
                src={art.urls[p]}
                alt=""
                draggable={false}
                className="h-full w-full select-none"
                style={{
                  transform: `rotate(${state.rot[p] * 90}deg)`,
                  touchAction: "none",
                  cursor: locked ? "default" : "grab",
                  outline: locked && rules.lockFeedback ? "2px solid var(--ok)" : undefined,
                  outlineOffset: -2,
                  pointerEvents: locked ? "none" : "auto",
                  opacity: p === hidden ? 0.2 : 1,
                }}
                onPointerDown={(e) => onPieceDown(e, p, size)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
