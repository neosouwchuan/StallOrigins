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
 * An outlet row with its brand embedded. Classification lives on the brand;
 * origin is the brand's country (via the `origin_country` FK to `countries`).
 * `location` is a PostGIS geography returned as EWKB hex, decoded client-side.
 */
interface CountryEmbed {
  code: string;
  name: string;
}
interface BrandEmbed {
  name: string;
  category: Category;
  subcategory_id: string | null;
  independence: Independence;
  independence_source: string | null;
  origin_source: string | null;
  countries: CountryEmbed | null; // via brands.origin_country
}
interface OutletRow {
  id: string;
  brand_id: string;
  name: string | null;
  location: string;
  address: string | null;
  building: string | null;
  updated_at: string | null;
  brands: BrandEmbed;
}

/**
 * Decode a PostGIS EWKB hex Point. `businesses.location` is NOT NULL and PostGIS
 * always emits a valid Point, so a location is always expected — malformed input
 * throws rather than silently dropping a pin.
 */
function decodeEwkbPoint(hex: string): { lat: number; lng: number } {
  if (!hex || hex.length < 42) throw new Error(`Invalid EWKB point: "${hex}"`);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  const type = view.getUint32(1, littleEndian);
  const offset = (type & 0x20000000) !== 0 ? 9 : 5;
  const lng = view.getFloat64(offset, littleEndian);
  const lat = view.getFloat64(offset + 8, littleEndian);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error(`Invalid EWKB point coordinates: "${hex}"`);
  }
  return { lat, lng };
}

function outletToBusiness(r: OutletRow): Business {
  const { lat, lng } = decodeEwkbPoint(r.location);
  const b = r.brands;
  const country = b.countries;
  return {
    id: r.id,
    brandId: r.brand_id,
    name: r.name ?? b.name,
    lat,
    lng,
    address: r.address ?? undefined,
    building: r.building ?? undefined,
    category: b.category,
    subcategory: b.subcategory_id ?? undefined,
    independence: normIndep(b.independence),
    origin: country ? { code: country.code, name: country.name } : undefined,
    independenceSource: b.independence_source ?? undefined,
    originSource: b.origin_source ?? undefined,
    updatedAt: r.updated_at ? r.updated_at.slice(0, 10) : undefined,
  };
}

/**
 * Fetch published outlets with their brand + country. Falls back to the
 * pre-migration-08 shape (brand.origin enum, no `countries`) so the map keeps
 * loading during the transition. Returns [] when Supabase isn't configured.
 */
export async function fetchBusinesses(): Promise<Business[]> {
  if (!supabase) return [];
  const q = await supabase
    .from("businesses")
    .select(
      "id,brand_id,name,location,address,building,updated_at," +
        "brands(name,category,subcategory_id,independence,independence_source,origin_source,countries(code,name))",
    )
    .eq("status", "published");
  if (!q.error) {
    return (q.data as unknown as OutletRow[]).map(outletToBusiness);
  }
  if (!/countr|origin_country|relationship|schema cache/i.test(q.error.message)) {
    throw new Error(q.error.message);
  }
  console.warn(
    "countries not found — reading legacy origin. Apply migration 08 for country origins.",
  );
  return fetchLegacy();
}

// --- Legacy fallback: migration-07 shape (brand.origin enum) ----------------
interface LegacyBrand {
  name: string;
  category: Category;
  subcategory_id: string | null;
  independence: Independence;
  independence_source: string | null;
  origin: string;
  origin_source: string | null;
}
interface LegacyRow extends Omit<OutletRow, "brands"> {
  brands: LegacyBrand;
}

async function fetchLegacy(): Promise<Business[]> {
  const { data, error } = await supabase!
    .from("businesses")
    .select(
      "id,brand_id,name,location,address,building,updated_at," +
        "brands(name,category,subcategory_id,independence,independence_source,origin,origin_source)",
    )
    .eq("status", "published");
  if (error) throw new Error(error.message);
  return (data as unknown as LegacyRow[]).map((r) => {
    const { lat, lng } = decodeEwkbPoint(r.location);
    const b = r.brands;
    const sg = b.origin === "local" || b.origin === "singaporean";
    return {
      id: r.id,
      brandId: r.brand_id,
      name: r.name ?? b.name,
      lat,
      lng,
      address: r.address ?? undefined,
      building: r.building ?? undefined,
      category: b.category,
      subcategory: b.subcategory_id ?? undefined,
      independence: normIndep(b.independence),
      origin: sg ? { code: "SG", name: "Singapore" } : undefined,
      independenceSource: b.independence_source ?? undefined,
      originSource: b.origin_source ?? undefined,
      updatedAt: r.updated_at ? r.updated_at.slice(0, 10) : undefined,
    };
  });
}
