/**
 * Single source of truth for map tiles (SPEC §8.1).
 *
 * The tile provider MUST be swappable via env vars alone — no component may
 * hard-code a tile URL. Switching provider = change env vars + redeploy.
 * Moving raster -> vector (e.g. self-hosted Protomaps .pmtiles) is contained
 * to this module.
 *
 * Env vars (all optional; sensible dev defaults below):
 *   VITE_TILE_URL          {z}/{x}/{y} template, or a .pmtiles URL for vector
 *   VITE_TILE_KIND         "raster" | "vector"        (default: raster)
 *   VITE_TILE_API_KEY      appended as ?key= when present
 *   VITE_TILE_ATTRIBUTION  attribution string shown on the map
 */

export type TileKind = "raster" | "vector";

export interface TileSource {
  kind: TileKind;
  /** URL template ({z}/{x}/{y}) for raster, or .pmtiles URL for vector. */
  url: string;
  attribution: string;
  maxZoom: number;
}

// Dev-only default. ⚠️ NEVER ship the public OSM tile server to production —
// its usage policy forbids app-scale traffic. Set VITE_TILE_URL in .env for
// any deployed build (MapTiler / Stadia free tier, or a self-hosted .pmtiles).
const DEV_RASTER_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function withKey(url: string, key: string | undefined): string {
  if (!key) return url;
  return url.includes("?") ? `${url}&key=${key}` : `${url}?key=${key}`;
}

export function getTileSource(): TileSource {
  const env = import.meta.env;
  // Use `||` not `??`: a var set to "" in .env is "unset", not a real value.
  const kind = (env.VITE_TILE_KIND as TileKind) || "raster";
  const rawUrl = (env.VITE_TILE_URL as string) || DEV_RASTER_URL;
  const attribution = (env.VITE_TILE_ATTRIBUTION as string) || OSM_ATTRIBUTION;

  return {
    kind,
    url: withKey(rawUrl, (env.VITE_TILE_API_KEY as string) || undefined),
    attribution,
    maxZoom: 19,
  };
}

/** True when we've fallen back to the dev-only public OSM tiles (var unset or ""). */
export function isUsingDevTiles(): boolean {
  return !import.meta.env.VITE_TILE_URL;
}
