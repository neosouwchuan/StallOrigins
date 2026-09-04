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
