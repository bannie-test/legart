"use client";

export interface DragGhost {
  url: string;
  x: number;
  y: number;
  size: number;
  rot: number;
  clip?: string;
}

export interface DragHandlers {
  onTap?: () => void;
  onMove?: (x: number, y: number) => void;
  onDrop?: (x: number, y: number, target: Element | null) => void;
  onCancel?: () => void;
}

const THRESHOLD = 6;

/**
 * Tracks one pointer from pointerdown until release: a short press is a tap, anything that moves
 * further than a few pixels is a drag. Listeners live on window so the drag survives re-renders.
 */
export function trackPointer(e: React.PointerEvent | PointerEvent, h: DragHandlers): void {
  const id = e.pointerId;
  const sx = e.clientX;
  const sy = e.clientY;
  let moved = false;
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > THRESHOLD) moved = true;
    if (moved) {
      ev.preventDefault();
      h.onMove?.(ev.clientX, ev.clientY);
    }
  };
  const done = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    cleanup();
    if (ev.type === "pointercancel") return h.onCancel?.();
    if (!moved) return h.onTap?.();
    h.onDrop?.(ev.clientX, ev.clientY, document.elementFromPoint(ev.clientX, ev.clientY));
  };
  const cleanup = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", done);
    window.removeEventListener("pointercancel", done);
  };
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", done);
  window.addEventListener("pointercancel", done);
}
