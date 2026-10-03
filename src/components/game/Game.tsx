"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "../Providers";
import { useL10n } from "../useL10n";
import { getArtwork } from "@/content/artworks";
import { db, newId, previousBest, type AttemptRecord } from "@/lib/db/local";
import { configKey, fromBase64, loadConfig, toBase64, type GameConfig, type StoredMosaic } from "@/lib/game-config";
import { resolveSource, SourceError } from "@/lib/image-source";
import { buildMosaic, focusCrop } from "@/lib/mosaic/client";
import type { Mosaic } from "@/lib/mosaic/engine";
import { renderFlat, renderMosaic } from "@/lib/mosaic/render";
import { initGame, penaltiesFromLog, progress, reduceGame, type GameState } from "@/lib/puzzle/game";
import { studsPerPiece } from "@/lib/puzzle/grid";
import { rulesFor } from "@/lib/puzzle/modes";
import { squareFull } from "@/lib/puzzle/square";
import { formatTime, puzzleScore, quizScore } from "@/lib/puzzle/scoring";
import type { Action, JigsawAction, LogEntry, PuzzleSpec } from "@/lib/puzzle/types";
import { libraryQuiz, memoryQuiz, questionsQuiz, type QuizItem } from "@/lib/quiz";
import { randomSeed } from "@/lib/rng";
import { trackPointer, type DragGhost } from "./drag";
import { JigsawBoard, type JigsawApi } from "./JigsawBoard";
import { buildPieces, revokePieces, type PieceArt } from "./pieces";
import { Quiz, type QuizAnswer } from "./Quiz";
import { Result, type ServerResult } from "./Result";
import { SquareBoard } from "./SquareBoard";
import { Tray } from "./Tray";

type Phase = "loading" | "error" | "countdown" | "playing" | "solved" | "quiz" | "result";

interface Assets {
  mosaic: Mosaic;
  canvas: HTMLCanvasElement;
  flatUrl: string;
  refUrl: string;
  stored: StoredMosaic;
}

const HIDDEN_LIMIT_MS = 30_000;
const NICKNAME_KEY = "legart:nickname";

export function Game() {
  const t = useTranslations("game");
  const tx = useL10n();
  const router = useRouter();
  const params = useSearchParams();
  const { supabase, user, ready, config: app, api } = useApp();

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<GameConfig | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const logRef = useRef<LogEntry[]>([]);
  const [art, setArt] = useState<PieceArt | null>(null);
  const assets = useRef<Assets | null>(null);
  const seedRef = useRef(0);
  const attemptRef = useRef<string | null>(null);
  const unrankedRef = useRef(false);
  const clock = useRef({ start: 0, offset: 0 });
  const [, setTick] = useState(0);
  const [count, setCount] = useState(3);
  const [area, setArea] = useState({ w: 300, h: 300 });
  const areaRef = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const [dragPiece, setDragPiece] = useState<number | null>(null);
  const jigsawApi = useRef<JigsawApi>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [peeking, setPeeking] = useState(false);
  const [refCollapsed, setRefCollapsed] = useState(false);
  const [refMode, setRefMode] = useState<"photo" | "mosaic">("photo");
  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  const solvedInfo = useRef<{ durationMs: number; penaltyMs: number; peeks: number; hints: number; moves: number } | null>(null);
  const serverRef = useRef<ServerResult | null>(null);
  const [result, setResult] = useState<{ record: AttemptRecord; prevBest: number | null; server: ServerResult | null } | null>(null);
  const lastSave = useRef(0);

  const rules = cfg ? rulesFor(cfg.mode, cfg.shape) : null;
  const elapsed = () => performance.now() - clock.current.start + clock.current.offset;

  // ------------------------------------------------------------------ loading
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const c = loadConfig();
      if (!c) {
        setError("no-config");
        return setPhase("error");
      }
      setCfg(c);
      try {
        const saved = params.get("resume") === "1" ? await db.saved.get("current") : undefined;
        const resumed = saved && configKey(saved.config) === configKey(c) && !saved.state.solved ? saved : undefined;

        const src = await resolveSource(c.source, supabase, c.challenge?.imageUrl);
        let mosaic: Mosaic;
        if (c.challenge) {
          mosaic = { ...c.challenge.mosaic, indices: fromBase64(c.challenge.mosaic.indices) };
        } else {
          const k = studsPerPiece(c.rows, c.cols, c.detail);
          const crop = focusCrop(src.bitmap.width, src.bitmap.height, c.cols / c.rows, c.focusX, c.focusY);
          mosaic = await buildMosaic(src.bitmap, crop, {
            width: c.cols * k, height: c.rows * k, paletteId: c.paletteId, dithering: c.dithering,
            brightness: c.brightness, contrast: c.contrast, saturation: c.saturation,
          });
        }
        const k = mosaic.width / c.cols;
        const canvas = renderMosaic(mosaic, Math.max(4, Math.round(120 / k))) as HTMLCanvasElement;
        const flat = renderFlat(mosaic) as HTMLCanvasElement;
        assets.current = {
          mosaic, canvas, flatUrl: flat.toDataURL(), refUrl: src.url,
          stored: { width: mosaic.width, height: mosaic.height, paletteId: mosaic.paletteId, indices: toBase64(mosaic.indices) },
        };

        // seed: resumed game > server-issued (ranked) > challenge > random
        let seed = c.challenge?.seed ?? randomSeed();
        if (resumed) {
          seed = resumed.seed;
          attemptRef.current = resumed.attemptId;
          unrankedRef.current = true;
        } else if (app.backend && (user || c.challenge)) {
          try {
            const res = await api("/api/attempts/start", {
              method: "POST",
              body: JSON.stringify({
                sourceKind: c.source.kind,
                sourceId: c.source.kind === "challenge" ? c.source.code : c.source.id,
                title: c.title, rows: c.rows, cols: c.cols, shape: c.shape, mode: c.mode, preview: c.preview,
                challengeCode: c.challenge?.code,
                guestName: user ? undefined : localStorage.getItem(NICKNAME_KEY) || undefined,
              }),
            });
            if (res.ok) {
              const j = await res.json();
              seed = j.seed;
              attemptRef.current = j.attemptId;
            }
          } catch {
            /* offline: play unranked */
          }
        }
        seedRef.current = seed;
        const spec: PuzzleSpec = { rows: c.rows, cols: c.cols, shape: c.shape, mode: c.mode, seed };
        const pieces = await buildPieces(canvas, c.rows, c.cols, c.shape, seed);
        if (cancelled) return revokePieces(pieces);
        setArt(pieces);
        const s = resumed?.state ?? initGame(spec);
        stateRef.current = s;
        setState(s);
        logRef.current = resumed?.log ?? [];
        clock.current.offset = resumed?.elapsedMs ?? 0;
        setPhase("countdown");
      } catch (e) {
        console.error(e);
        setError(e instanceof SourceError ? e.code : "load-failed");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => () => revokePieces(art), [art]);

  // ------------------------------------------------------------------ countdown & clock
  useEffect(() => {
    if (phase !== "countdown") return;
    setCount(3);
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        clock.current.start = performance.now();
        setPhase("playing");
      } else setCount(n);
    }, 800);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setTick((x) => x + 1), 100);
    return () => clearInterval(id);
  }, [phase]);

  // ------------------------------------------------------------------ board size
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase === "loading" || phase === "error"]);

  // ------------------------------------------------------------------ persistence & visibility
  const persist = useCallback(
    (force = false) => {
      const c = cfg;
      const s = stateRef.current;
      if (!c || !s || s.solved) return;
      if (!force && Date.now() - lastSave.current < 800) return;
      lastSave.current = Date.now();
      db.saved
        .put({ key: "current", config: c, seed: seedRef.current, state: s, log: logRef.current, elapsedMs: elapsed(), attemptId: attemptRef.current, savedAt: Date.now() })
        .catch(() => {});
    },
    [cfg],
  );

  useEffect(() => {
    if (phase !== "playing") return;
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        persist(true);
      } else if (hiddenAt && Date.now() - hiddenAt > HIDDEN_LIMIT_MS) {
        unrankedRef.current = true;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase, persist]);

  // ------------------------------------------------------------------ actions
  const dispatch = useCallback(
    (a: Action) => {
      if (phase !== "playing" || !rules) return;
      const prev = stateRef.current!;
      const next = reduceGame(prev, a, rules);
      const marker = a.type === "hint" || a.type === "peek";
      if (!marker && next === prev) return;
      logRef.current.push({ t: Math.round(elapsed()), a });
      stateRef.current = next;
      setState(next);
      if (next.solved) return void onSolved();
      persist();
      if (navigator.vibrate && !marker && progress(next) > progress(prev)) navigator.vibrate(12);
      if (next.kind === "square" && cfg?.mode === "expert" && squareFull(next)) {
        setToast(t("notYet"));
        setTimeout(() => setToast(null), 1800);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, rules, persist, cfg],
  );

  async function onSolved() {
    const c = cfg!;
    const r = rulesFor(c.mode, c.shape);
    const log = logRef.current;
    const durationMs = log[log.length - 1]?.t ?? Math.round(elapsed());
    const pen = penaltiesFromLog(log, r);
    solvedInfo.current = { durationMs, penaltyMs: pen.penaltyMs, peeks: pen.peeks, hints: pen.hints, moves: stateRef.current!.moves };
    setPhase("solved");
    db.saved.delete("current").catch(() => {});
    if (navigator.vibrate) navigator.vibrate([30, 60, 30]);

    if (attemptRef.current) {
      try {
        const res = await api("/api/attempts/finish", {
          method: "POST",
          body: JSON.stringify({ attemptId: attemptRef.current, log, unranked: unrankedRef.current }),
        });
        if (res.ok) serverRef.current = await res.json();
      } catch {
        /* keep the local record */
      }
    }

    const a = assets.current!;
    const libId = c.source.kind === "library" ? c.source.id : c.challenge?.artworkId;
    const lib = libId ? getArtwork(libId) : undefined;
    let items: QuizItem[];
    if (c.challenge?.questions.length) items = questionsQuiz(c.challenge.questions, seedRef.current);
    else if (lib) items = libraryQuiz(lib, seedRef.current);
    else items = memoryQuiz(a.mosaic, seedRef.current, squareThumbs(), c.cols, c.rows);
    setQuizItems(items);
    setTimeout(() => (items.length ? setPhase("quiz") : finishWithQuiz([])), 1400);
  }

  /** Square crops of each piece, used by the memory quiz (also for jigsaw games). */
  function squareThumbs(): string[] {
    const a = assets.current!;
    const c = cfg!;
    const size = a.canvas.width / c.cols;
    const out: string[] = [];
    const tmp = document.createElement("canvas");
    tmp.width = tmp.height = 96;
    const ctx = tmp.getContext("2d")!;
    for (let i = 0; i < c.rows * c.cols; i++) {
      ctx.clearRect(0, 0, 96, 96);
      ctx.drawImage(a.canvas, (i % c.cols) * size, Math.floor(i / c.cols) * size, size, size, 0, 0, 96, 96);
      out.push(tmp.toDataURL("image/jpeg", 0.8));
    }
    return out;
  }

  async function finishWithQuiz(answers: QuizAnswer[]) {
    const c = cfg!;
    const info = solvedInfo.current!;
    const totalMs = info.durationMs + info.penaltyMs;
    const qPts = quizScore(answers);
    const score = puzzleScore(totalMs, c.mode, c.shape, c.rows * c.cols) + qPts;
    const correct = answers.filter((x) => x?.correct).length;
    const server = serverRef.current;
    const record: AttemptRecord = {
      id: attemptRef.current ?? newId(),
      createdAt: Date.now(),
      sourceKind: c.source.kind,
      sourceId: c.source.kind === "challenge" ? c.source.code : c.source.id,
      title: c.title,
      pieces: c.rows * c.cols, shape: c.shape, mode: c.mode, preview: c.preview,
      durationMs: info.durationMs, penaltyMs: info.penaltyMs, totalMs,
      moves: info.moves, peeks: info.peeks, hints: info.hints,
      quizCorrect: correct, quizTotal: answers.length, score,
      status: server?.status ?? "local",
      cloudId: attemptRef.current ?? undefined,
      challengeCode: c.challenge?.code,
      rank: server?.rank ?? undefined,
    };
    const prevBest = await previousBest(record).catch(() => null);
    await db.attempts.put(record).catch(() => {});
    if (attemptRef.current) {
      api("/api/attempts/quiz", {
        method: "POST",
        body: JSON.stringify({ attemptId: attemptRef.current, correct, total: answers.length, quizScore: qPts }),
      }).catch(() => {});
    }
    setResult({ record, prevBest, server });
    setPhase("result");
  }

  function hint() {
    const s = stateRef.current;
    if (!s || !rules) return;
    const used = logRef.current.filter((e) => e.a.type === "hint").length;
    if (rules.hintLimit === 0 || (rules.hintLimit > 0 && used >= rules.hintLimit)) return;
    if (s.kind === "square") {
      const i = s.cells.findIndex((p, cell) => !(p === cell && s.rot[cell] === 0));
      const piece = i;
      if (piece < 0) return;
      dispatch({ type: "hint" });
      for (let r = s.rot[piece]; r % 4 !== 0; r++) dispatch({ type: "rotate", piece });
      dispatch({ type: "drop", piece, to: piece });
    } else {
      const piece = s.pieces.findIndex((p) => !p.locked);
      if (piece < 0) return;
      dispatch({ type: "hint" });
      for (let r = s.pieces[piece].rot; r % 4 !== 0; r++) dispatch({ type: "rotate", piece });
      dispatch({ type: "drop", piece, x: piece % s.cols, y: Math.floor(piece / s.cols) });
    }
  }

  function startPeek() {
    if (!rules || !cfg || cfg.preview !== "hold" || phase !== "playing") return;
    const used = logRef.current.filter((e) => e.a.type === "peek").length;
    if (rules.maxPeeks >= 0 && used >= rules.maxPeeks) return;
    dispatch({ type: "peek" });
    setPeeking(true);
    if (rules.peekDurationMs > 0) setTimeout(() => setPeeking(false), rules.peekDurationMs);
  }

  // ------------------------------------------------------------------ drag from tray / square board
  function onPieceDown(e: React.PointerEvent, piece: number, size: number) {
    const s = stateRef.current;
    if (!s || !art || phase !== "playing") return;
    const rot = s.kind === "square" ? s.rot[piece] : s.pieces[piece].rot;
    const ghostSize = s.kind === "square" ? Math.max(size, 56) : Math.max(size, 56) * 1.25;
    trackPointer(e, {
      onTap: () => dispatch({ type: "rotate", piece }),
      onMove: (x, y) => {
        setDragPiece(piece);
        setGhost({ url: art.urls[piece], x, y, size: ghostSize, rot });
      },
      onDrop: (x, y, target) => {
        setGhost(null);
        setDragPiece(null);
        if (s.kind === "square") {
          const cell = target?.closest<HTMLElement>("[data-cell]");
          if (cell) dispatch({ type: "drop", piece, to: Number(cell.dataset.cell) });
          else if (target?.closest("[data-tray]")) dispatch({ type: "drop", piece, to: "tray" });
        } else if (!target?.closest("[data-tray]")) {
          const pos = jigsawApi.current?.clientToPiece(x, y);
          if (pos) dispatch({ type: "drop", piece, x: pos.x, y: pos.y });
        }
      },
      onCancel: () => {
        setGhost(null);
        setDragPiece(null);
      },
    });
  }

  function leave() {
    if (phase === "playing" && !window.confirm(t("leaveConfirm"))) return;
    persist(true);
    router.push("/");
  }

  // ------------------------------------------------------------------ render
  if (phase === "error") {
    return (
      <div className="card mx-auto mt-10 max-w-md p-6 text-center">
        <p className="font-semibold">{t(`errors.${error ?? "load-failed"}`)}</p>
        {error === "missing-library-image" && <pre className="mt-3 rounded bg-black/5 p-2 text-xs">npm run library:fetch</pre>}
        <button className="btn mt-4" onClick={() => router.push("/")}>{t("home")}</button>
      </div>
    );
  }

  if (phase === "result" && result && cfg && assets.current) {
    return (
      <div className="min-h-dvh" style={{ background: "var(--bg)" }}>
        <Result
          config={cfg}
          record={result.record}
          prevBest={result.prevBest}
          server={result.server}
          attemptId={attemptRef.current}
          mosaicCanvas={assets.current.canvas}
          storedMosaic={assets.current.stored}
          imageUrl={assets.current.refUrl}
          onPlayAgain={() => window.location.replace("/play")}
        />
      </div>
    );
  }

  if (phase === "quiz") {
    return (
      <div className="min-h-dvh pt-6" style={{ background: "var(--bg)" }}>
        <h1 className="text-center text-2xl font-extrabold">{t("quizTitle")}</h1>
        <Quiz items={quizItems} onDone={finishWithQuiz} />
      </div>
    );
  }

  const s = state;
  const a = assets.current;
  const shown = elapsed();
  const pen = cfg && rules ? penaltiesFromLog(logRef.current, rules) : null;
  const hintsUsed = pen?.hints ?? 0;
  const peeksUsed = pen?.peeks ?? 0;
  const refSrc = refMode === "photo" ? a?.refUrl : a?.flatUrl;
  const trayIds = s ? s.tray : [];
  const progressPct = s ? Math.round(progress(s) * 100) : 0;

  return (
    <div className="fixed inset-0 flex select-none flex-col" style={{ background: "var(--bg)" }}>
      {/* top bar */}
      <div className="flex shrink-0 items-center gap-2 border-b px-2 py-1.5" style={{ borderColor: "var(--border)", background: "var(--surface)", paddingTop: "max(0.375rem, env(safe-area-inset-top))" }}>
        <button className="btn btn-sm btn-ghost" onClick={leave} aria-label={t("back")}>←</button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{cfg ? tx(cfg.title) : ""}</div>
          <div className="text-xs muted">
            {s && cfg?.mode !== "expert" ? `${progressPct}% · ` : ""}
            {t("moves", { n: s?.moves ?? 0 })}
          </div>
        </div>
        <div className="text-right font-mono text-lg font-bold tabular-nums" aria-live="off">
          {phase === "playing" || phase === "solved" ? formatTime(phase === "solved" && solvedInfo.current ? solvedInfo.current.durationMs : shown) : "0:00.0"}
          {pen && pen.penaltyMs > 0 && <div className="text-[10px] font-normal muted">+{pen.penaltyMs / 1000}s</div>}
        </div>
        {cfg?.preview === "hold" && rules && (
          <button
            className="btn btn-sm"
            disabled={phase !== "playing" || (rules.maxPeeks >= 0 && peeksUsed >= rules.maxPeeks)}
            onPointerDown={startPeek}
            onPointerUp={() => rules.peekDurationMs === 0 && setPeeking(false)}
            onPointerLeave={() => rules.peekDurationMs === 0 && setPeeking(false)}
            aria-label={t("peek")}
            title={t("peekHelp")}
          >
            👁
          </button>
        )}
        {rules && rules.hintLimit !== 0 && (
          <button className="btn btn-sm" disabled={phase !== "playing" || (rules.hintLimit > 0 && hintsUsed >= rules.hintLimit)} onClick={hint} title={t("hintHelp", { s: rules.hintPenaltyMs / 1000 })}>
            💡{rules.hintLimit > 0 ? ` ${rules.hintLimit - hintsUsed}` : ""}
          </button>
        )}
      </div>

      {/* reference + board */}
      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row">
        {cfg?.preview === "always" && a && (
          <div className="shrink-0 border-b landscape:w-[34%] landscape:border-b-0 landscape:border-r" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 px-2 py-1 text-xs">
              <button className="underline" onClick={() => setRefCollapsed(!refCollapsed)}>{refCollapsed ? t("showRef") : t("hideRef")}</button>
              {!refCollapsed && (
                <button className="underline" onClick={() => setRefMode(refMode === "photo" ? "mosaic" : "photo")}>
                  {refMode === "photo" ? t("refMosaic") : t("refPhoto")}
                </button>
              )}
            </div>
            {!refCollapsed && (
              <img src={refSrc} alt={t("reference")} className="mx-auto max-h-[22vh] object-contain px-2 pb-2 landscape:max-h-[calc(100dvh-160px)]" style={{ imageRendering: refMode === "mosaic" ? "pixelated" : undefined }} />
            )}
          </div>
        )}
        <div ref={areaRef} className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
          {phase === "loading" && <div className="text-center"><div className="text-4xl">🧱</div><p className="mt-2 muted">{t("building")}</p></div>}
          {s && art && a && rules && s.kind === "square" && (
            <SquareBoard state={s} art={art} rules={rules} ghostUrl={a.flatUrl} area={area} hidden={dragPiece} onPieceDown={onPieceDown} />
          )}
          {s && art && a && rules && s.kind === "jigsaw" && (
            <JigsawBoard state={s} art={art} rules={rules} ghostUrl={a.flatUrl} area={area} onAction={(x: JigsawAction) => dispatch(x)} apiRef={jigsawApi} />
          )}
          {phase === "countdown" && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
              <div key={count} className="animate-pop text-8xl font-black text-white">{count}</div>
            </div>
          )}
          {phase === "solved" && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30">
              <div className="animate-pop rounded-2xl bg-white px-6 py-4 text-center text-2xl font-black text-[#1b2a34]">🎉 {t("solved")}</div>
            </div>
          )}
          {peeking && refSrc && (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
              <img src={refSrc} alt={t("reference")} className="max-h-full max-w-full object-contain" />
            </div>
          )}
          {toast && <div className="animate-shake absolute top-3 z-40 rounded-full bg-black/80 px-4 py-2 text-sm text-white">{toast}</div>}
        </div>
      </div>

      {s && art && (
        <Tray
          ids={trayIds}
          dimmed={dragPiece}
          art={art}
          rot={(i) => (s.kind === "square" ? s.rot[i] : s.pieces[i].rot)}
          jigsaw={s.kind === "jigsaw"}
          onPieceDown={onPieceDown}
        />
      )}

      {ghost && (
        <img
          src={ghost.url}
          alt=""
          className="pointer-events-none fixed z-50"
          style={{
            left: ghost.x - ghost.size / 2, top: ghost.y - ghost.size / 2, width: ghost.size, height: ghost.size,
            transform: `rotate(${ghost.rot * 90}deg) scale(1.05)`, filter: "drop-shadow(0 6px 10px rgba(0,0,0,.35))",
          }}
        />
      )}
    </div>
  );
}
