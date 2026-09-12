import { supabase } from "../lib/supabase";
import type {
  Business,
  Category,
  Independence,
  Origin,
} from "../domain/classification";

/**
 * Reading published outlets from Supabase. Classification lives on the brand
 * (SPEC §3/§4), so the preferred query embeds the brand. During the migration
 * window the hosted DB may still be the FLAT schema (classification on
 * `businesses`, no `brands`); we detect that and fall back, so the app works
 * against either shape. `location` is a PostGIS geography returned as EWKB hex.
 */

interface BrandEmbed {
  name: string;
  category: Category;
  subcategory_id: string | null;
  independence: Independence;
  origin: Origin;
  independence_source: string | null;
  origin_source: string | null;
}
interface OutletRow {
  id: string;
  name: string | null; // outlet branch label; null → use brand name
  location: string;
  address: string | null;
  building: string | null;
  updated_at: string | null;
  brands: BrandEmbed; // embedded (many outlets → one brand)
}
interface FlatRow {
  id: string;
  name: string;
  location: string;
  address: string | null;
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
 * `businesses.location` is NOT NULL and PostGIS always emits a valid Point, so
 * a location is always expected — malformed input throws rather than silently
 * dropping a pin.
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

function outletToBusiness(r: OutletRow): Business {
  const { lat, lng } = decodeEwkbPoint(r.location);
  const brand = r.brands;
  return {
    id: r.id,
    name: r.name ?? brand.name,
    lat,
    lng,
    address: r.address ?? undefined,
    building: r.building ?? undefined,
    category: brand.category,
    subcategory: brand.subcategory_id ?? undefined,
    independence: brand.independence,
    origin: brand.origin,
    independenceSource: brand.independence_source ?? undefined,
    originSource: brand.origin_source ?? undefined,
    updatedAt: r.updated_at ? r.updated_at.slice(0, 10) : undefined,
  };
}

function flatToBusiness(r: FlatRow): Business {
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

/** True when the error means the `brands` relationship isn't in the schema yet. */
function isMissingBrands(message: string): boolean {
  return /relationship|brands|schema cache/i.test(message);
}

/**
 * Fetch published businesses. Prefers the brand-embed query; falls back to the
 * flat schema while the hosted DB hasn't had migration 07 applied. Returns []
 * when Supabase isn't configured (caller uses bundled sample data).
 */
export async function fetchBusinesses(): Promise<Business[]> {
  if (!supabase) return [];

  const withBrand = await supabase
    .from("businesses")
    .select(
      "id,name,location,address,building,updated_at," +
        "brands(name,category,subcategory_id,independence,origin,independence_source,origin_source)",
    )
    .eq("status", "published");

  if (!withBrand.error) {
    return (withBrand.data as unknown as OutletRow[]).map(outletToBusiness);
  }
  if (!isMissingBrands(withBrand.error.message)) {
    throw new Error(withBrand.error.message);
  }

  // Fallback: flat schema (pre-migration-07). Remove once migration 07 is applied.
  console.warn(
    "brands table not found — reading flat schema. Apply migration 07 to enable the brand model.",
  );
  const flat = await supabase
    .from("businesses")
    .select(
      "id,name,location,address,category,subcategory_id,independence,origin,independence_source,origin_source,updated_at",
    )
    .eq("status", "published");
  if (flat.error) throw new Error(flat.error.message);
  return (flat.data as unknown as FlatRow[]).map(flatToBusiness);
}
