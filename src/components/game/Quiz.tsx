"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { QuizItem } from "@/lib/quiz";
import { QUIZ_SECONDS } from "@/lib/puzzle/scoring";
import { useL10n } from "../useL10n";

export interface QuizAnswer {
  correct: boolean;
  ms: number;
}

export function Quiz({ items, onDone }: { items: QuizItem[]; onDone: (a: QuizAnswer[]) => void }) {
  const t = useTranslations("quiz");
  const tx = useL10n();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(QUIZ_SECONDS);
  const answers = useRef<QuizAnswer[]>([]);
  const started = useRef(performance.now());
  const item = items[idx];

  useEffect(() => {
    started.current = performance.now();
    setLeft(QUIZ_SECONDS);
    setPicked(null);
  }, [idx]);

  useEffect(() => {
    if (picked !== null) return;
    const id = setInterval(() => {
      const remaining = QUIZ_SECONDS - (performance.now() - started.current) / 1000;
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) choose(-1);
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, idx]);

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    answers.current[idx] = { correct: i === item.correct, ms: performance.now() - started.current };
  }

  function next() {
    if (idx + 1 < items.length) setIdx(idx + 1);
    else onDone(answers.current);
  }

  return (
    <div className="mx-auto w-full max-w-lg p-4">
      <div className="flex items-center justify-between text-sm muted">
        <span>{t("progress", { n: idx + 1, total: items.length })}</span>
        <span aria-live="polite">⏱ {Math.ceil(left)}s</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
        <div className="h-full" style={{ width: `${(left / QUIZ_SECONDS) * 100}%`, background: "var(--accent)", transition: "width .2s linear" }} />
      </div>
      <h2 className="mt-4 text-xl font-bold">{tx(item.prompt)}</h2>
      <div className={`mt-4 grid gap-2 ${item.options[0]?.kind === "text" ? "" : "grid-cols-2"}`}>
        {item.options.map((o, i) => {
          const state = picked === null ? "" : i === item.correct ? "correct" : i === picked ? "wrong" : "";
          return (
            <button
              key={i}
              className="btn h-auto min-h-12 justify-start py-2 text-left"
              disabled={picked !== null && state === ""}
              style={{
                borderColor: state === "correct" ? "var(--ok)" : state === "wrong" ? "#d33" : undefined,
                borderWidth: state ? 3 : 1,
              }}
              onClick={() => choose(i)}
            >
              {o.kind === "text" && <span>{tx(o.text)}</span>}
              {o.kind === "color" && (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-8 w-8 rounded-full border" style={{ background: o.hex }} />
                  {o.name && tx(o.name)}
                </span>
              )}
              {o.kind === "image" && <img src={o.src} alt="" className="mx-auto h-20 w-20 object-contain" />}
              {state === "correct" && <span className="ml-auto">✓</span>}
              {state === "wrong" && <span className="ml-auto">✗</span>}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="mt-4 animate-pop">
          <p className="font-semibold">{picked === item.correct ? t("right") : picked === -1 ? t("timeout") : t("wrong")}</p>
          {item.explain && <p className="mt-1 text-sm muted">{tx(item.explain)}</p>}
          <button className="btn btn-primary mt-4 w-full" onClick={next}>{idx + 1 < items.length ? t("next") : t("finish")}</button>
        </div>
      )}
    </div>
  );
}
