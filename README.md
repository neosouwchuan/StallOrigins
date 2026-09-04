# StallOrigins

A map overlay (installable PWA) helping Singaporeans find and support genuinely
local, independent businesses. Built on OpenStreetMap + Leaflet.

See [SPEC.md](SPEC.md) for the full product & technical spec, and
[docs/classification-criteria.md](docs/classification-criteria.md) for the
classification policy.

**Pilot area:** Tiong Bahru.

## Getting started

```bash
npm install
npm run dev
```

The app opens on the Tiong Bahru pilot area with sample businesses. In local dev
it uses public OpenStreetMap tiles — fine for development, **not** for
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

## Scripts
- `npm run dev` — dev server
- `npm run build` — typecheck + production build
- `npm run typecheck` — types only

## Status
Phase 0 (foundations) — scaffold, classification model, swappable tiles, pilot
boundary, sample data. Supabase backend + crowdsourcing come in later phases.

## Attribution
Map data © OpenStreetMap contributors (ODbL).
