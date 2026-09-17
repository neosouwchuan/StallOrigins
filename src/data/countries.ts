import { supabase, runQuery } from "../lib/supabase";

export interface Country {
  code: string;
  name: string;
}

/** The official country list (ISO 3166-1) from the `countries` table. */
export async function fetchCountries(): Promise<Country[]> {
  if (!supabase) return [];
  const data = await runQuery<Country[]>(() =>
    supabase!.from("countries").select("code,name").order("name"),
  );
  return (data as Country[]) ?? [];
}
