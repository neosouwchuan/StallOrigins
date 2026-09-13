import { supabase } from "../lib/supabase";

/** A building polygon as editable vertices ([lat, lng], open ring). */
export interface BuildingShape {
  id: string;
  name: string;
  coords: [number, number][];
}

interface BuildingRow {
  id: string;
  name: string;
  kind: string;
  geojson: string;
}

/** Load building polygons (from the GeoJSON view) as editable vertex lists. */
export async function fetchBuildings(): Promise<BuildingShape[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("buildings_public")
    .select("id,name,kind,geojson");
  if (error) throw new Error(error.message);
  return ((data as BuildingRow[]) ?? []).map((r) => {
    const gj = JSON.parse(r.geojson) as { coordinates: number[][][] };
    const ring = gj.coordinates?.[0] ?? [];
    // GeoJSON rings are [lng,lat] and closed (last = first); drop the closing
    // point and convert to [lat,lng] for Leaflet.
    const open = ring.slice(0, Math.max(0, ring.length - 1));
    return {
      id: r.id,
      name: r.name,
      coords: open.map(([lng, lat]) => [lat, lng] as [number, number]),
    };
  });
}

/** Write an edited polygon back to `buildings.boundary` (admin only, via RLS). */
export async function saveBuildingBoundary(
  id: string,
  coords: [number, number][],
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  if (coords.length < 3) throw new Error("A building needs at least 3 points.");
  const pts = coords.map(([lat, lng]) => `${lng} ${lat}`);
  pts.push(pts[0]); // close the ring
  const wkt = `SRID=4326;POLYGON((${pts.join(", ")}))`;
  const { error } = await supabase
    .from("buildings")
    .update({ boundary: wkt })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Re-derive every stall's building after boundaries change (admin only). */
export async function recomputeMembership(): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("recompute_building_membership");
  if (error) throw new Error(error.message);
}
