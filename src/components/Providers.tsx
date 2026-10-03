"use client";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

export interface ClientConfig {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  siteUrl: string | null;
  /** true when the server also has the service-role key (rankings, challenges, share pages) */
  backend: boolean;
}

interface AuthState {
  config: ClientConfig;
  supabase: SupabaseClient | null;
  session: Session | null;
  user: User | null;
  ready: boolean;
  signOut: () => Promise<void>;
  /** fetch() that adds the user's access token when signed in */
  api: (input: string, init?: RequestInit) => Promise<Response>;
}

const Ctx = createContext<AuthState | null>(null);

export function Providers({ config, children }: { config: ClientConfig; children: React.ReactNode }) {
  const supabase = useMemo(() => getBrowserClient(config.supabaseUrl, config.supabaseAnonKey), [config.supabaseUrl, config.supabaseAnonKey]);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setSession(null);
  }, [supabase]);

  const api = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (token) headers.set("authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    },
    [supabase],
  );

  const value: AuthState = { config, supabase, session, user: session?.user ?? null, ready, signOut, api };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside <Providers>");
  return v;
}
