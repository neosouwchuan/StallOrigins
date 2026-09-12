import { supabase } from "../lib/supabase";
import type {
  Business,
  Category,
  Independence,
  Origin,
} from "../domain/classification";

/**
 * Row from the `businesses` table. `location` is a PostGIS geography, which
 * PostgREST returns as EWKB hex (e.g. "0101000020E6100000…"); we decode it to
 * lat/lng client-side (see decodeEwkbPoint). Reading the table directly means
 * the app does not depend on the `businesses_public` view being present.
 */
interface BusinessRow {
  id: string;
  name: string;
  location: string; // EWKB hex
  address: string | null;
  postal_code: string | null;
  category: Category;
  subcategory_id: string | null;
  independence: Independence;
  origin: Origin;
  independence_source: string | null;
  origin_source: string | null;
  updated_at: string | null;
}

/**
 * Decode a PostGIS EWKB hex Point (little/big-endian, with or without SRID).
 * `businesses.location` is NOT NULL in the schema and PostGIS always emits a
 * valid Point, so a location is always expected — malformed input throws
 * (surfacing a real data problem) rather than silently dropping a pin.
 */
function decodeEwkbPoint(hex: string): { lat: number; lng: number } {
  if (!hex || hex.length < 42) {
    throw new Error(`Invalid EWKB point: "${hex}"`);
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  const type = view.getUint32(1, littleEndian);
  const hasSrid = (type & 0x20000000) !== 0;
  const offset = hasSrid ? 9 : 5; // skip order(1)+type(4)[+srid(4)]
  const lng = view.getFloat64(offset, littleEndian);
  const lat = view.getFloat64(offset + 8, littleEndian);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error(`Invalid EWKB point coordinates: "${hex}"`);
  }
  return { lat, lng };
}

function rowToBusiness(r: BusinessRow): Business {
  const { lat, lng } = decodeEwkbPoint(r.location);
  return {
    id: r.id,
    name: r.name,
    lat,
    lng,
    address: r.address ?? undefined,
    category: r.category,
    subcategory: r.subcategory_id ?? undefined,
    independence: r.independence,
    origin: r.origin,
    independenceSource: r.independence_source ?? undefined,
    originSource: r.origin_source ?? undefined,
    updatedAt: r.updated_at ? r.updated_at.slice(0, 10) : undefined,
  };
}

/**
 * Fetch published businesses from Supabase. RLS restricts anon to published
 * rows; we also filter explicitly. Returns [] when Supabase isn't configured
 * (caller falls back to sample data). Every row has a location (NOT NULL), so
 * each maps to exactly one Business.
 */
export async function fetchBusinesses(): Promise<Business[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id,name,location,address,postal_code,category,subcategory_id,independence,origin,independence_source,origin_source,updated_at",
    )
    .eq("status", "published");
  if (error) throw new Error(error.message);
  return (data as BusinessRow[] | null)?.map(rowToBusiness) ?? [];
}
