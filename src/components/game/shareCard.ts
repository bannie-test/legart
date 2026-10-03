"use client";
import QRCode from "qrcode";

export interface CardData {
  mosaic: HTMLCanvasElement;
  title: string;
  subtitle: string;
  time: string;
  stats: string[];
  player: string;
  url: string;
  brandLine: string;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number, weight: number, size: number) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px Inter, system-ui, sans-serif`;
    s -= 2;
  } while (ctx.measureText(text).width > max && s > 18);
}

/** Achievement card, 1080x1350 (post) or 1080x1920 (story). */
export async function drawShareCard(d: CardData, format: "post" | "story"): Promise<Blob> {
  const W = 1080, H = format === "post" ? 1350 : 1920;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  // studded background
  ctx.fillStyle = "#c91a09";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let y = 18; y < H; y += 36) for (let x = 18; x < W; x += 36) {
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  const pad = 60;
  const top = format === "post" ? 60 : 200;
  // mosaic
  const maxW = W - pad * 2;
  const maxH = format === "post" ? 760 : 1000;
  const scale = Math.min(maxW / d.mosaic.width, maxH / d.mosaic.height);
  const mw = d.mosaic.width * scale, mh = d.mosaic.height * scale;
  const mx = (W - mw) / 2;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, mx - 14, top - 14, mw + 28, mh + 28, 22);
  ctx.fill();
  ctx.drawImage(d.mosaic, mx, top, mw, mh);
  // panel
  const py = top + mh + 40;
  const ph = H - py - pad;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, pad, py, W - pad * 2, ph, 28);
  ctx.fill();
  ctx.fillStyle = "#1b2a34";
  fitText(ctx, d.title, W - pad * 2 - 300, 800, 50);
  ctx.fillText(d.title, pad + 36, py + 72);
  ctx.font = "500 30px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#5d6870";
  ctx.fillText(d.subtitle, pad + 36, py + 116);
  ctx.fillStyle = "#c91a09";
  ctx.font = "900 96px Inter, system-ui, sans-serif";
  ctx.fillText(d.time, pad + 36, py + 230);
  ctx.fillStyle = "#1b2a34";
  ctx.font = "600 30px Inter, system-ui, sans-serif";
  d.stats.forEach((s, i) => ctx.fillText(s, pad + 36, py + 290 + i * 42));
  ctx.fillStyle = "#5d6870";
  ctx.font = "500 26px Inter, system-ui, sans-serif";
  ctx.fillText(`${d.player} · ${d.brandLine}`, pad + 36, py + ph - 36);
  // QR
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, d.url, { width: 220, margin: 1 });
  ctx.drawImage(qr, W - pad - 36 - 220, py + 36);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
}

export async function shareOrDownload(blob: Blob, filename: string, text: string, url: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text, url });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return "downloaded";
}
