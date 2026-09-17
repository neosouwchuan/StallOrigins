import { supabase, runQuery } from "../lib/supabase";
import type {
  Category,
  Independence,
  OriginCountry,
} from "../domain/classification";

/** A brand carries the classification; outlets (businesses) reference it. */
export interface Brand {
  id: string;
  name: string;
  category: Category;
  independence: Independence;
  origin?: OriginCountry;
}

interface BrandRow {
  id: string;
  name: string;
  category: Category;
  independence: string;
  countries: { code: string; name: string } | null; // via origin_country FK
}

/** Fold the retired `chain_small` value into `chain` (defensive). */
function normIndep(i: string): Independence {
  return i === "chain_small" ? "chain" : (i as Independence);
}

/** Fetch every brand with its country. Returns [] when Supabase isn't configured. */
export async function fetchBrands(): Promise<Brand[]> {
  if (!supabase) return [];
  const data = await runQuery<BrandRow[]>(() =>
    supabase!
      .from("brands")
      .select("id,name,category,independence,countries(code,name)")
      .order("name"),
  );
  return ((data as unknown as BrandRow[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    independence: normIndep(r.independence),
    origin: r.countries
      ? { code: r.countries.code, name: r.countries.name }
      : undefined,
  }));
}
