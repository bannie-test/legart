"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useApp } from "@/components/Providers";
import { useL10n } from "@/components/useL10n";
import { BADGES } from "@/content/badges";
import { db, type AttemptRecord, type LocalImage } from "@/lib/db/local";
import { formatTime } from "@/lib/puzzle/scoring";

interface CloudImage { id: string; title: string; created_at: string }

export default function MePage() {
  const t = useTranslations("me");
  const ts = useTranslations("setup");
  const tx = useL10n();
  const locale = useLocale();
  const router = useRouter();
  const { user, supabase, signOut, api, config } = useApp();
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [images, setImages] = useState<(LocalImage & { url: string })[]>([]);
  const [cloud, setCloud] = useState<CloudImage[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    db.attempts.orderBy("createdAt").reverse().toArray().then(setAttempts).catch(() => {});
    db.images.orderBy("createdAt").reverse().toArray().then((list) => setImages(list.map((i) => ({ ...i, url: URL.createObjectURL(i.blob) })))).catch(() => {});
  }, []);
  useEffect(() => () => images.forEach((i) => URL.revokeObjectURL(i.url)), [images]);

  useEffect(() => {
    if (!user || !supabase) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => setName((typed) => typed || (data?.display_name ?? "")));
    supabase.from("user_images").select("id, title, created_at").order("created_at", { ascending: false }).then(({ data }) => setCloud(data ?? []));
  }, [user, supabase]);

  const bests = useMemo(() => {
    const m = new Map<string, AttemptRecord>();
    for (const a of attempts) {
      const k = [a.sourceId, a.pieces, a.shape, a.mode].join("|");
      const cur = m.get(k);
      if (!cur || a.totalMs < cur.totalMs) m.set(k, a);
    }
    return [...m.values()].sort((a, b) => a.totalMs - b.totalMs).slice(0, 30);
  }, [attempts]);

  const totalTime = attempts.reduce((s, a) => s + a.totalMs, 0);

  async function saveName() {
    if (!user || !supabase) return;
    const { error } = await supabase.from("profiles").update({ display_name: name.trim().slice(0, 32) || "Player" }).eq("id", user.id);
    setMsg(error ? error.message : t("saved"));
  }

  async function syncHistory() {
    const res = await api("/api/attempts/import", { method: "POST", body: JSON.stringify({ attempts: attempts.filter((a) => !a.cloudId) }) });
    const j = await res.json().catch(() => ({}));
    setMsg(res.ok ? t("synced", { n: j.imported ?? 0 }) : j.error ?? "error");
  }

  async function deleteAccount() {
    if (!window.confirm(t("deleteConfirm"))) return;
    const res = await api("/api/account", { method: "DELETE" });
    if (res.ok) {
      await signOut();
      setMsg(t("deleted"));
    } else setMsg((await res.json().catch(() => ({}))).error ?? "error");
  }

  async function removeLocal(id: string) {
    await db.images.delete(id);
    setImages(images.filter((i) => i.id !== id));
  }

  async function removeCloud(id: string) {
    if (!supabase || !user) return;
    await supabase.storage.from("user-images").remove([`${user.id}/${id}.jpg`]);
    await supabase.from("user_images").delete().eq("id", id);
    setCloud(cloud.filter((c) => c.id !== id));
  }

  async function clearHistory() {
    if (!window.confirm(t("clearConfirm"))) return;
    await db.attempts.clear();
    setAttempts([]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>

      <section className="card space-y-3 p-4">
        {config.supabaseUrl ? (
          user ? (
            <>
              <div className="text-sm muted">{user.email}</div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">{t("displayName")}</span>
                <div className="flex gap-2">
                  <input className="input" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} />
                  <button className="btn" onClick={saveName}>{t("save")}</button>
                </div>
              </label>
              <div className="flex flex-wrap gap-2">
                {config.backend && <button className="btn btn-sm" onClick={syncHistory}>{t("sync")}</button>}
                <button className="btn btn-sm" onClick={signOut}>{t("logout")}</button>
                {config.backend && <button className="btn btn-sm" style={{ color: "#d33" }} onClick={deleteAccount}>{t("deleteAccount")}</button>}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">{t("guestInfo")}</p>
              <Link href="/login" className="btn btn-primary btn-sm">{t("login")}</Link>
            </div>
          )
        ) : (
          <p className="text-sm muted">{t("offlineInfo")}</p>
        )}
        {msg && <p className="text-sm muted">{msg}</p>}
      </section>

      <section className="grid grid-cols-3 gap-2 text-center">
        <Stat label={t("finished")} value={String(attempts.length)} />
        <Stat label={t("totalTime")} value={formatTime(totalTime).split(".")[0]} />
        <Stat label={t("badges")} value={`${BADGES.filter((b) => b.test(attempts)).length}/${BADGES.length}`} />
      </section>

      <section>
        <h2 className="mb-2 font-bold">{t("badges")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {BADGES.map((b) => {
            const ok = b.test(attempts);
            return (
              <div key={b.id} className="card p-3 text-center" style={{ opacity: ok ? 1 : 0.4 }} title={tx(b.desc)}>
                <div className="text-2xl">{b.icon}</div>
                <div className="text-xs font-semibold">{tx(b.name)}</div>
                <div className="text-[10px] muted">{tx(b.desc)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-bold">{t("myImages")}</h2>
        {images.length === 0 && cloud.length === 0 && (
          <p className="text-sm muted">{t("noImages")} <Link className="underline" href="/upload">{t("uploadOne")}</Link></p>
        )}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {images.map((i) => (
            <div key={i.id} className="card overflow-hidden">
              <button className="block w-full" onClick={() => router.push(`/setup?src=local:${i.id}`)}>
                <img src={i.url} alt={i.name} className="aspect-square w-full object-cover" />
              </button>
              <div className="flex items-center gap-1 p-1 text-xs">
                <span className="flex-1 truncate">{i.name}{i.cloudId ? " ☁️" : ""}</span>
                <button aria-label={t("delete")} onClick={() => removeLocal(i.id)}>✕</button>
              </div>
            </div>
          ))}
          {cloud.filter((c) => !images.some((i) => i.cloudId === c.id)).map((c) => (
            <div key={c.id} className="card overflow-hidden">
              <button className="flex aspect-square w-full items-center justify-center text-3xl" onClick={() => router.push(`/setup?src=cloud:${c.id}`)}>☁️</button>
              <div className="flex items-center gap-1 p-1 text-xs">
                <span className="flex-1 truncate">{c.title}</span>
                <button aria-label={t("delete")} onClick={() => removeCloud(c.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-bold">{t("bests")}</h2>
        {bests.length === 0 ? <p className="text-sm muted">{t("noGames")}</p> : (
          <div className="card divide-y" style={{ borderColor: "var(--border)" }}>
            {bests.map((a) => (
              <div key={a.id} className="flex items-center gap-2 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{tx(a.title)}</div>
                  <div className="text-xs muted">{a.pieces} · {ts(`shapes.${a.shape}`)} · {ts(`modes.${a.mode}`)}</div>
                </div>
                <div className="font-mono tabular-nums">{formatTime(a.totalMs)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">{t("history")}</h2>
          {attempts.length > 0 && <button className="text-xs underline" onClick={clearHistory}>{t("clear")}</button>}
        </div>
        <div className="card divide-y" style={{ borderColor: "var(--border)" }}>
          {attempts.slice(0, 50).map((a) => (
            <div key={a.id} className="flex items-center gap-2 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate">{tx(a.title)}</div>
                <div className="text-xs muted">
                  {new Date(a.createdAt).toLocaleString(locale)} · {a.pieces} · {ts(`modes.${a.mode}`)} · {t(`status.${a.status}`)}
                  {a.quizTotal ? ` · ${a.quizCorrect}/${a.quizTotal}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono tabular-nums">{formatTime(a.totalMs)}</div>
                <div className="text-xs muted">{a.score.toLocaleString(locale)}</div>
              </div>
            </div>
          ))}
          {attempts.length === 0 && <p className="p-3 text-sm muted">{t("noGames")}</p>}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-xl font-black tabular-nums">{value}</div>
      <div className="text-xs muted">{label}</div>
    </div>
  );
}
