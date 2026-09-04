import { supabase } from "../lib/supabase";
import type {
  Business,
  Category,
  Independence,
  Origin,
} from "../domain/classification";

/** Shape of a row from the `businesses_public` view (SQL migration 06). */
interface BusinessRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  postal_code: string | null;
  category: Category;
  subcategory_id: string | null;
  subcategory_label: string | null;
  independence: Independence;
  origin: Origin;
  independence_source: string | null;
  origin_source: string | null;
  website: string | null;
  data_source: string;
  status: string;
  updated_at: string | null;
}

function rowToBusiness(r: BusinessRow): Business {
  return {
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    address: r.address ?? undefined,
    category: r.category,
    subcategory: r.subcategory_label ?? r.subcategory_id ?? undefined,
    independence: r.independence,
    origin: r.origin,
    independenceSource: r.independence_source ?? undefined,
    originSource: r.origin_source ?? undefined,
    updatedAt: r.updated_at ? r.updated_at.slice(0, 10) : undefined,
  };
}

/**
 * Fetch published businesses from Supabase. RLS on the underlying table already
 * restricts anon to published rows; we also filter explicitly for clarity.
 * Returns [] when Supabase isn't configured (caller falls back to sample data).
 */
export async function fetchBusinesses(): Promise<Business[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("businesses_public")
    .select("*")
    .eq("status", "published");
  if (error) throw new Error(error.message);
  return (data as BusinessRow[] | null)?.map(rowToBusiness) ?? [];
}
