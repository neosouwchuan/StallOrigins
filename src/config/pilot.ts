/**
 * Pilot area — Bukit Panjang Plaza + Hillion Mall (SPEC §2).
 *
 * Two adjacent malls at the Bukit Panjang integrated transport hub. The map
 * opens here, and Phase 1 seeding is restricted to `bounds` — we only ingest
 * businesses inside these two malls. Single source of truth: the map, the
 * seeding script, and any "in pilot area" checks all read from here.
 *
 * The map itself still works island-wide (no gating); this only sets the
 * starting view and the seeding confine.
 */
export const PILOT = {
  name: "Bukit Panjang",
  /** Midpoint between the two malls. */
  center: [1.3784, 103.7633] as [number, number],
  zoom: 17,
  /**
   * Bounding box covering both malls + the transport hub between them.
   * WGS84 (EPSG:4326). Used verbatim for the Overpass seeding query.
   */
  bounds: {
    south: 1.3772,
    west: 103.7618,
    north: 1.3798,
    east: 103.7648,
  },
} as const;

/**
 * The buildings inside the pilot area. Used to assign each seeded outlet a
 * `building` by nearest centre (SPEC §4/§6 — group shops by building).
 */
export const BUILDINGS = [
  { name: "Bukit Panjang Plaza", lat: 1.3786, lng: 103.7627 },
  { name: "Hillion Mall", lat: 1.3782, lng: 103.7639 },
] as const;

/** Name of the building whose centre is nearest the given point. */
export function nearestBuilding(lat: number, lng: number): string {
  let best: (typeof BUILDINGS)[number] = BUILDINGS[0];
  let bestD = Infinity;
  for (const b of BUILDINGS) {
    const d = (b.lat - lat) ** 2 + (b.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best.name;
}

/** Overpass `bbox` filter string: "south,west,north,east". */
export function pilotBboxString(): string {
  const { south, west, north, east } = PILOT.bounds;
  return `${south},${west},${north},${east}`;
}

/** True if a coordinate falls inside the pilot bounding box. */
export function isInPilotArea(lat: number, lng: number): boolean {
  const { south, west, north, east } = PILOT.bounds;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}
