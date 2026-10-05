"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/components/Providers";

function Login() {
  const t = useTranslations("login");
  const router = useRouter();
  const params = useSearchParams();
  const { supabase, user, ready } = useApp();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/me";

  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, next, router]);

  if (!supabase) return <p className="mt-10 text-center">{t("noBackend")}</p>;
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/login?next=${encodeURIComponent(next)}` : undefined;

  async function oauth(provider: "google" | "facebook") {
    setErr(null);
    const { error } = await supabase!.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) setErr(error.message);
  }

  async function magic(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 pt-4">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-sm muted">{t("why")}</p>
      <button className="btn w-full" onClick={() => oauth("google")}>{t("google")}</button>
      <button className="btn w-full" onClick={() => oauth("facebook")}>{t("facebook")}</button>
      <div className="text-center text-xs muted">{t("or")}</div>
      {sent ? (
        <p className="card p-4 text-sm">{t("sent", { email })}</p>
      ) : (
        <form onSubmit={magic} className="space-y-2">
          <input className="input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-primary w-full">{t("magic")}</button>
        </form>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
