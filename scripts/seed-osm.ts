/**
 * Seed businesses from OpenStreetMap, CONFINED to the pilot bounding box
 * (Bukit Panjang Plaza + Hillion Mall). SPEC §5.
 *
 * Server-side only — writes with the Supabase SERVICE key (bypasses RLS), so
 * this is never bundled into the client. Run it from your machine / CI.
 *
 *   npm run seed:osm:dry     # query Overpass + print, no DB write, no creds
 *   npm run seed:osm         # write to Supabase (needs SUPABASE_* env vars)
 *
 * Env (put in .env — the SERVICE key is NOT VITE_ prefixed and must stay secret):
 *   SUPABASE_URL           (falls back to VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_KEY   (required for a real run)
 *   OVERPASS_URL           (optional; default overpass-api.de)
 *
 * Re-runs are safe: rows upsert on `osm_id` with ignoreDuplicates, so existing
 * pins (and any human classifications on them) are never overwritten.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { PILOT, pilotBboxString, isInPilotArea } from "../src/config/pilot.ts";

const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Minimal .env loader (no dependency). Only sets vars not already in the env.
// ---------------------------------------------------------------------------
function loadDotEnv(path = ".env") {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

// ---------------------------------------------------------------------------
// OSM tags -> our (category, subcategory_id). subcategory slugs must match the
// `subcategories` lookup (migration 05). null subcategory is allowed.
// ---------------------------------------------------------------------------
type Category = "fnb" | "retail" | "services";
interface Tags {
  [k: string]: string | undefined;
}

function classify(t: Tags): { category: Category; subcategory: string | null } | null {
  const shop = t.shop;
  const amenity = t.amenity;
  const craft = t.craft;

  // Food & drink
  if (amenity === "restaurant" || amenity === "fast_food")
    return { category: "fnb", subcategory: "restaurant" };
  if (amenity === "cafe") return { category: "fnb", subcategory: "cafe" };
  if (amenity === "bar" || amenity === "pub")
    return { category: "fnb", subcategory: "bar" };
  if (amenity === "food_court" || amenity === "ice_cream")
    return { category: "fnb", subcategory: null };
  if (shop === "bakery" || shop === "pastry" || shop === "confectionery")
    return { category: "fnb", subcategory: "bakery" };
  if (shop === "coffee" || shop === "tea")
    return { category: "fnb", subcategory: "cafe" };

  // Retail
  if (shop === "greengrocer" || shop === "farm")
    return { category: "retail", subcategory: "grocer" };
  if (shop === "convenience" || shop === "kiosk" || shop === "supermarket")
    return { category: "retail", subcategory: "minimart" };
  if (shop === "books" || shop === "stationery")
    return { category: "retail", subcategory: "bookshop" };
  if (shop === "clothes" || shop === "boutique" || shop === "fashion" || shop === "shoes")
    return { category: "retail", subcategory: "clothing" };
  if (shop === "hardware" || shop === "doityourself")
    return { category: "retail", subcategory: "hardware" };
  if (shop === "chemist" || amenity === "pharmacy")
    return { category: "retail", subcategory: "pharmacy" };

  // Services
  if (amenity === "clinic" || amenity === "doctors" || amenity === "dentist")
    return { category: "services", subcategory: "clinic" };
  if (shop === "hairdresser" || amenity === "hairdresser" || shop === "beauty")
    return { category: "services", subcategory: "barber" };
  if (shop === "laundry" || shop === "dry_cleaning")
    return { category: "services", subcategory: "laundry" };
  if (shop === "optician") return { category: "services", subcategory: "optician" };
  if (shop === "tailor" || craft === "tailor")
    return { category: "services", subcategory: "tailor" };
  if (shop === "shoe_repair" || shop === "locksmith" || craft === "shoemaker")
    return { category: "services", subcategory: "repair" };

  // Generic fallbacks (keep the pin, no confident subcategory)
  if (shop) return { category: "retail", subcategory: null };
  if (amenity) return { category: "fnb", subcategory: null };
  if (craft) return { category: "services", subcategory: null };
  return null;
}

interface Row {
  name: string;
  location: string; // EWKT — geography accepts 'SRID=4326;POINT(lng lat)'
  address: string | null;
  postal_code: string | null;
  category: Category;
  subcategory_id: string | null;
  osm_id: string;
  data_source: "osm";
}

interface OverpassEl {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Tags;
}

async function queryOverpass(): Promise<OverpassEl[]> {
  const bbox = pilotBboxString(); // "south,west,north,east"
  const ql = `[out:json][timeout:60];
(
  nwr["shop"](${bbox});
  nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|pub|ice_cream|pharmacy|clinic|doctors|dentist)$"](${bbox});
  nwr["craft"](${bbox});
);
out center tags;`;

  const endpoint =
    process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "StallOrigins-seeder/0.1 (civic map; contact: souwchuann@gmail.com)",
    },
    body: "data=" + encodeURIComponent(ql),
  });
  if (!res.ok) {
    throw new Error(`Overpass HTTP ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { elements: OverpassEl[] };
  return json.elements ?? [];
}

function toRows(elements: OverpassEl[]): Row[] {
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    const name = t.name;
    if (!name) continue; // skip unnamed features

    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat === undefined || lng === undefined) continue;
    if (!isInPilotArea(lat, lng)) continue; // strictly honour the confine

    const cls = classify(t);
    if (!cls) continue;

    const osm_id = `${el.type}/${el.id}`;
    if (seen.has(osm_id)) continue;
    seen.add(osm_id);

    const addr = [t["addr:housenumber"], t["addr:street"]]
      .filter(Boolean)
      .join(" ");

    rows.push({
      name,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      address: addr || null,
      postal_code: t["addr:postcode"] ?? null,
      category: cls.category,
      subcategory_id: cls.subcategory,
      osm_id,
      data_source: "osm",
    });
  }
  return rows;
}

async function main() {
  loadDotEnv();

  console.log(`Pilot area: ${PILOT.name} — bbox ${pilotBboxString()}`);
  console.log("Querying Overpass…");
  const elements = await queryOverpass();
  const rows = toRows(elements);
  console.log(
    `Overpass returned ${elements.length} elements → ${rows.length} named, in-bounds, classified businesses.`,
  );

  // Preview
  for (const r of rows) {
    console.log(
      `  • ${r.name}  [${r.category}${r.subcategory_id ? "/" + r.subcategory_id : ""}]  ${r.osm_id}`,
    );
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "\nMissing SUPABASE_URL and/or SUPABASE_SERVICE_KEY (service key, not the anon key).\n" +
        "Add them to .env, or run with --dry-run to preview without writing.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // ignoreDuplicates: never overwrite existing rows / human classifications.
  const { data, error } = await supabase
    .from("businesses")
    .upsert(rows, { onConflict: "osm_id", ignoreDuplicates: true })
    .select("osm_id");
  if (error) throw new Error(error.message);

  console.log(
    `\nInserted ${data?.length ?? 0} new businesses (existing pins left untouched).`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
