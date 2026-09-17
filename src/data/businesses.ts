import { supabase } from "../lib/supabase";
import type {
  Business,
  Category,
  Independence,
} from "../domain/classification";

/** Fold the retired `chain_small` value into `chain` (defensive). */
function normIndep(i: string): Independence {
  return i === "chain_small" ? "chain" : (i as Independence);
}

/**
 * A row of `businesses_public` — the client read view. It flattens each outlet
 * with its brand + building + country, and exposes the pin as plain lat/lng
 * (ST_Y/ST_X), so no client-side PostGIS decoding is needed.
 */
interface PublicRow {
  id: string;
  brand_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  unit: string | null;
  building_id: string | null;
  building: string | null;
  category: Category;
  subcategory_id: string | null;
  independence: string;
  independence_source: string | null;
  origin_country: string | null;
  origin_country_name: string | null;
  origin_source: string | null;
  updated_at: string | null;
}

function toBusiness(r: PublicRow): Business {
  return {
    id: r.id,
    brandId: r.brand_id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    address: r.address ?? undefined,
    unit: r.unit ?? undefined,
    building:
      r.building_id && r.building
        ? { id: r.building_id, name: r.building }
        : undefined,
    category: r.category,
    subcategory: r.subcategory_id ?? undefined,
    independence: normIndep(r.independence),
    origin: r.origin_country
      ? { code: r.origin_country, name: r.origin_country_name ?? r.origin_country }
      : undefined,
    independenceSource: r.independence_source ?? undefined,
    originSource: r.origin_source ?? undefined,
    updatedAt: r.updated_at ? r.updated_at.slice(0, 10) : undefined,
  };
}

/** Fetch published outlets from the read view. Returns [] when unconfigured. */
export async function fetchBusinesses(): Promise<Business[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("businesses_public")
    .select(
      "id,brand_id,name,lat,lng,address,unit,building_id,building,category," +
        "subcategory_id,independence,independence_source,origin_country," +
        "origin_country_name,origin_source,updated_at",
    )
    .eq("status", "published");
  if (error) throw new Error(error.message);
  return ((data as unknown as PublicRow[]) ?? []).map(toBusiness);
}
