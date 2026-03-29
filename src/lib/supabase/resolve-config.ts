/** Default API URL for `npx supabase start` — matches `[api] port` in `supabase/config.toml`. */
const DEFAULT_LOCAL_SUPABASE_API_URL = "http://127.0.0.1:54321";

export type ResolvedSupabaseEnv = { url: string; anonKey: string };

/**
 * Hosted: set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Dashboard → API).
 *
 * Local CLI: run `npm run db:start`, then either set both URL (e.g. 127.0.0.1:54321) and anon key from
 * `npm run db:status`, or set `NEXT_PUBLIC_SUPABASE_USE_LOCAL=true` and only the anon key (URL defaults).
 */
export function resolveSupabaseEnvConfig(): ResolvedSupabaseEnv {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const urlExplicit = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const useLocal =
    process.env.NEXT_PUBLIC_SUPABASE_USE_LOCAL === "true" ||
    process.env.NEXT_PUBLIC_SUPABASE_USE_LOCAL === "1";

  if (!anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is required. For local Supabase, copy the anon key from `npm run db:status`."
    );
  }

  const url = urlExplicit ?? (useLocal ? DEFAULT_LOCAL_SUPABASE_API_URL : undefined);

  if (!url) {
    throw new Error(
      `Set NEXT_PUBLIC_SUPABASE_URL for hosted Supabase, or NEXT_PUBLIC_SUPABASE_USE_LOCAL=true to use ${DEFAULT_LOCAL_SUPABASE_API_URL} (local CLI).`
    );
  }

  return { url, anonKey };
}
