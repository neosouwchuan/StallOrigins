import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client, configured from env vars (see .env.example).
 * Only the PUBLIC anon key ships to the browser — Row-Level Security is the
 * real security boundary (SPEC §8). Never put the service key in a VITE_ var.
 *
 * When the env vars are absent (e.g. before a project exists), the client is
 * null and the app falls back to bundled sample data — so it always runs.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;

type QueryResult = { data: unknown; error: { message: string } | null };

/**
 * Run a PostgREST/RPC call, recovering from an expired access token. When the
 * attached JWT has expired, we refresh the session and retry once; if the
 * refresh itself fails the session is dead, so we sign out (dropping the stale
 * token) and retry as the anon role — which still satisfies world-readable
 * queries instead of leaving the UI stuck on an error. Callers cast the result.
 */
export async function runQuery<T = unknown>(
  build: () => PromiseLike<QueryResult>,
): Promise<T | null> {
  let res = await build();
  if (res.error && /jwt|token|expired/i.test(res.error.message) && supabase) {
    const { error } = await supabase.auth.refreshSession();
    if (error) await supabase.auth.signOut();
    res = await build();
  }
  if (res.error) throw new Error(res.error.message);
  return res.data as T | null;
}
