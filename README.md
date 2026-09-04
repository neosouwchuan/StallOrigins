# StallOrigins

A map overlay (installable PWA) helping Singaporeans find and support genuinely
local, independent businesses. Built on OpenStreetMap + Leaflet.

See [SPEC.md](SPEC.md) for the full product & technical spec, and
[docs/classification-criteria.md](docs/classification-criteria.md) for the
classification policy.

**Pilot focus:** Bukit Panjang Plaza + Hillion Mall — seeding is confined to the
two malls (`src/config/pilot.ts`). The map still works island-wide; coverage is
incomplete.

## Getting started

```bash
npm install
npm run dev
```

The app opens centred on the Bukit Panjang malls with sample businesses. In
local dev it uses public OpenStreetMap tiles — fine for development, **not** for
deployment (see tile strategy below).

## Tile strategy (swappable by design — SPEC §8.1)

The map data (OpenStreetMap) is free; only **tile hosting** costs money. The
tile source is isolated in [`src/map/tileSource.ts`](src/map/tileSource.ts) and
driven entirely by env vars, so switching provider — or moving from a hosted
free tier to a self-hosted Protomaps `.pmtiles` file — is a config change, not a
code change. No component hard-codes a tile URL.

Copy [`.env.example`](.env.example) to `.env` and set `VITE_TILE_URL` (plus
`VITE_TILE_API_KEY`) to a provider (MapTiler / Stadia free tier) before
deploying.

## Data (Supabase)

The app reads businesses from Supabase when configured, and falls back to
bundled sample data otherwise (so it always runs). See
[`supabase/README.md`](supabase/README.md) for the schema, migrations, and how
to stand up a project. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in
`.env` to connect.

## Scripts
- `npm run dev` — dev server
- `npm run build` — typecheck + production build
- `npm run typecheck` — types only
- `npm run seed:osm:dry` — query OpenStreetMap (Overpass) for tenants inside the
  pilot malls and print them; no database, no credentials
- `npm run seed:osm` — same, but upsert into Supabase as `unverified` pins.
  Needs `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (the **service** key, kept in
  `.env`, never `VITE_`-prefixed). Re-runs never overwrite existing rows.

## Status
Phase 0–1 groundwork: scaffold, classification model, swappable tiles, sample
data, full Supabase schema + migrations, the read path wired to Supabase, and an
OSM/Overpass seeder confined to the pilot malls. Crowdsourcing write path
(submission form + moderation) is next.

## Attribution
Map data © OpenStreetMap contributors (ODbL).
