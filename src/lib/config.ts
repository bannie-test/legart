import "server-only";

/** Runtime configuration, read from the environment when a request is served (not at build time),
 *  so one Docker image can be pointed at any Supabase project. */
export interface PublicConfig {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  siteUrl: string | null;
}

export function getPublicConfig(): PublicConfig {
  return {
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    siteUrl: process.env.SITE_URL || null,
  };
}

export function backendEnabled(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
