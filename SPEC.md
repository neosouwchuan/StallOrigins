# StallOrigins — Product & Technical Spec

*Draft v0.1 — 2026-09-04. Owner: souwchuann@gmail.com*

A map-based web app (installable PWA) that helps Singaporeans find and support
genuinely local, independent businesses — by showing, for each business, **what
kind of business it is** (independent vs chain) and **who owns it** (local vs
foreign). Built as an OpenStreetMap + Leaflet overlay.

> **Status of this document:** the spec is the source of truth for the design.
> Items marked **[DECIDE]** still need your confirmation.

---

## 1. Goals & non-goals

### Goals
- Let a user open a map of Singapore and instantly see which nearby businesses
  are **independent and locally owned**.
- Let users **filter** the map (e.g. "show only 🇸🇬 independent hawkers").
- Let the community **contribute and correct** classifications, with sources.
- Ship as **one codebase** that works as a website and installs as an app (PWA).
- Launch **narrow and deep** with a single fully-classified area so the map is
  useful on day one.

### Non-goals (for now)
- We do **not** publish the personal identity (full name, NRIC, address) of any
  owner. Owner *stories* are a later, **opt-in** feature only.
- We are **not** a reviews/ratings platform (no star ratings in v1).
- We are **not** a food-delivery or ordering platform.
- We do not attempt to auto-detect ownership from any dataset — every
  local/foreign claim is human-submitted with a source.

---

## 2. Pilot scope (cold-start strategy)

To avoid launching a map that is 50,000 grey "Unverified" pins, v1 covers **one
tightly-bounded area, fully classified**, before any public launch.

- **✅ CONFIRMED pilot area: Bukit Panjang Plaza + Hillion Mall** (updated
  2026-09-04). Two adjacent malls at the Bukit Panjang integrated transport hub.
  - A dense, enclosed mix of tenants — independent stalls, local chains, and
    foreign franchises side by side — the exact contrast the app exists to
    reveal.
  - A small, well-defined footprint (two buildings) makes it realistic to
    classify **every** tenant by hand for launch.
- **Seeding is confined to these two malls.** Phase 1 ingests only businesses
  inside the pilot bounding box, defined once in
  [`src/config/pilot.ts`](src/config/pilot.ts) (`PILOT.bounds`) and reused
  verbatim by the Overpass query.
- Target for "launch-ready": **≥90% of tenants in the two malls classified** on
  both axes (independence + origin), each with a source.
- Expansion after pilot: nearby areas, then island-wide.

**Display coverage is island-wide, not gated.** The app accepts and shows
businesses **anywhere in Singapore** and openly accepts that coverage is
incomplete. The Bukit Panjang malls are only where we *focus seeding &
classification effort* for launch, not a boundary that restricts what the map
can display. The map simply opens centred on the malls; nothing is shaded or
marked out-of-scope. (There is deliberately no `coverage_areas` table — see §4.)

---

## 3. Classification model

Each business carries **two independent tags**. Both default to *Unverified*.

### Axis A — Independence (structure / scale ONLY)
This axis says nothing about local vs foreign — that is entirely Axis B's job.
| Code | Label | Definition |
|---|---|---|
| `independent` | 🧍 Independent | Single owner-operated outlet |
| `chain_small` | 🏘️ Small chain | 2–5 outlets |
| `chain` | 🏢 Chain | Large chain (>5 outlets) |
| `franchise` | 🔗 Franchise | Operates under a licensed brand (origin shown separately) |
| `unverified` | ❔ Unverified | Not yet classified |

### Axis B — Ownership origin (by COUNTRY)
Origin is the **country of ownership**, chosen from the official `countries`
list (ISO 3166-1 alpha-2; all ~249 countries, seeded in migration 08). It's a
FK `brands.origin_country`; **`SG` is the buy-local signal**, and **null =
unverified**. The classify form is a type-to-search picker whose final value
must come from the list (no free text). The map filter stays a coarse
🇸🇬 Singaporean / 🌍 Foreign / ❔ Unverified split (Singaporean = `SG`, Foreign =
any other code, Unverified = null), while each pin card shows the specific flag +
country name. Flags are computed from the code, not stored.

### Published classification criteria (must be public in-app)
Because "local vs foreign" is contentious, the rules must be transparent and
applied consistently:

- **Origin = local** if >50% of the business is beneficially owned by Singapore
  citizens/PRs, *or* the operating entity is SG-incorporated **and** not a
  subsidiary/franchisee of a foreign parent.
- **Origin = foreign** if majority-owned by non-residents or a subsidiary /
  master-franchise of an overseas brand (e.g. an international coffee chain).
- **When in doubt → `unverified`.** We never guess. Better an honest blank than
  a wrong label.
- Every non-`unverified` value **requires a `source`** (see data model): a URL,
  a citation ("owner confirmed in person, 2026-09"), or an ACRA entity number.

> A locally-owned *franchisee* of a foreign brand is a genuine grey area: the
> independence tag is always `franchise`, but its **origin** ("local" or
> "foreign") needs a stated editorial stance before public launch — see §11.

### Franchises & chains (worked examples) — for future review
The two axes exist precisely so that **"chain/franchise" and "foreign" are never
collapsed into one judgment**. A chain can be local; a single outlet can be a
foreign franchise. `chain` = one company owns many outlets; `franchise` = a
brand licenses independent operators — but *neither value implies an origin*.

| Business (from the Bukit Panjang pilot) | Independence | Origin | Point it makes |
|---|---|---|---|
| Independent kopitiam stall | 🧍 Independent | 🇸🇬 Local | The purest "support local" target |
| FairPrice | 🏢 Chain | 🇸🇬 Local | Big chain, but Singaporean (NTUC) |
| Popular | 🏢 Chain | 🇸🇬 Local | Local bookstore chain |
| Ya Kun Kaya Toast | 🔗 Franchise | 🇸🇬 Local | Franchised, but a homegrown SG brand |
| Watsons / Guardian | 🏢 Chain | 🌍 Foreign | *Feels* local, but foreign-owned |
| McDonald's / Starbucks | 🔗 Franchise | 🌍 Foreign | Foreign brand |

The rows that justify the two-axis design are **Watsons** (a chain that reads as
local but isn't) and **FairPrice / Popular** (chains that *are* local) — a
one-dimensional "chain = not local" label gets all three wrong.

**✅ Standardized model — every business belongs to a brand.** Classification is
a property of the **brand**, not the individual outlet. A `businesses` row is an
**outlet** (a physical location/pin) and references exactly one `brands` row via
`brand_id` (NOT NULL). The brand carries the identity + classification
(`name`, `independence`, `origin`, sources, `category`, `subcategory`); the
outlet carries only location-specific facts (coordinates, address, building).

This is **universal** — an independent single store is simply a brand with
`independence = independent` and exactly one outlet. There is no special-casing:
McDonald's is a brand with many outlets; "Ah Hock's kopitiam stall" is a brand
with one. Benefits:
- Classify a brand **once** → the label applies to every branch automatically.
- Two outlets of the same brand can never disagree.
- Pairs naturally with the group-by-building feature (§6).

See the `brands` and `businesses` tables in §4. (Superseded the earlier
per-outlet classification, decided 2026-09.)

---

## 4. Data model

Backend: **Supabase** (PostgreSQL + PostGIS + Auth + Storage + Row-Level
Security). PostGIS gives "businesses near me" and "in polygon" queries directly.
This is the full planned schema through Phase 4, designed as a whole.

### 4.0 Enum types
Modelled as Postgres `enum`s so invalid values are impossible at the DB level.

| Enum | Values |
|---|---|
| `independence_level` | `independent`, `chain_small`, `chain`, `franchise`, `unverified` (structure/scale only — no local/foreign here) |
| ~~`origin_level`~~ | Removed in migration 08 — origin is now a FK to the `countries` table (`brands.origin_country`), not an enum |
| `business_category` | `fnb`, `retail`, `services` |
| `business_status` | `published`, `hidden` |
| `submission_kind` | `new`, `edit` |
| `submission_status` | `pending`, `approved`, `rejected` |
| `flag_status` | `open`, `resolved`, `dismissed` |
| `user_role` | `contributor`, `moderator`, `admin` |
| `claim_status` | `pending`, `verified`, `rejected` |

### Table: `profiles` — Phase 2
Extends Supabase `auth.users` with app-specific data.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | = `auth.users.id`, FK on delete cascade |
| `display_name` | text | |
| `role` | `user_role` | default `contributor` |
| `contributions_count` | int | default 0 |
| `created_at` | timestamptz | default now() |

> **No `coverage_areas` table.** We accept businesses anywhere in Singapore and
> accept that coverage is incomplete (not every stall will be present). The
> pilot malls are a *classification-effort focus* (§2), not a boundary that
> gates the data — so it is not modelled as a table.

### Table: `app_settings` — Phase 2
Runtime-toggleable feature flags (§6.1). Key/boolean rows read by both the app
and RLS policies.
| Column | Type | Notes |
|---|---|---|
| `key` | text pk | e.g. `allow_anonymous_flagging` |
| `enabled` | boolean | default false |
| `description` | text | |
| `updated_at` | timestamptz | default now() |

### Table: `subcategories` — Phase 1
Lookup so subcategories stay consistent (no free-text drift).
| Column | Type | Notes |
|---|---|---|
| `id` | text pk | slug, e.g. `hawker_stall` |
| `category` | `business_category` | parent axis |
| `label` | text | e.g. "Hawker stall" |

### Table: `brands` — Phase 1  (identity + classification live HERE)
Every outlet belongs to exactly one brand (§3). Classification is per-brand, so
it is set once and applies to all branches. An **independent single store is a
brand with one outlet**; a chain/franchise is a brand with many — no special
casing.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | default `gen_random_uuid()` |
| `name` | text | not null — the brand / business name |
| `category` | `business_category` | not null |
| `subcategory_id` | text null | FK → `subcategories.id` |
| `independence` | `independence_level` | not null, default `unverified` |
| `origin_country` | text null | FK → `countries.code` (ISO 3166-1); null = unverified; `SG` = buy-local. Migration 08 |
| `independence_source` | text | **required when** independence ≠ unverified (CHECK) |
| `origin_source` | text | **required when** `origin_country` is set (CHECK) |
| `website` | text | |
| `created_by` | uuid null | FK → `profiles.id` |
| `created_at` / `updated_at` | timestamptz | default now() |

### Table: `countries` — Phase 2 (migration 08)
Official ISO 3166-1 country list; public read-only reference data for the origin
picker and the `businesses_public` join. Flags are computed from the code.
| Column | Type | Notes |
|---|---|---|
| `code` | text pk | ISO 3166-1 alpha-2 (e.g. `SG`, `US`) |
| `name` | text | English name |

### Table: `businesses` (outlets) — Phase 1 (seeded) → Phase 2 (moderated writes)
A physical **outlet / map pin**. Holds location-specific facts only; its
classification comes from its `brand`. Public reads published rows; writes via
the approval path.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | default `gen_random_uuid()` |
| `brand_id` | uuid | **not null**, FK → `brands.id` — the brand this outlet is |
| `name` | text null | optional branch label (defaults to the brand name) |
| `location` | geography(Point,4326) | not null; PostGIS |
| `address` | text | |
| `postal_code` | text | |
| `building` | text null | Building/mall the outlet sits in (e.g. "Bukit Panjang Plaza") — **group shops by building** (Phase 1, §6). Added in migration 07; the seeder sets it by nearest-mall |
| `osm_id` | text unique null | provenance if imported from OSM |
| `data_source` | text | `osm` \| `datagovsg` \| `manual` \| `community` (origin of the pin) |
| `status` | `business_status` | not null, default `published` |
| `created_by` | uuid null | FK → `profiles.id` |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() |

> **Brands workflow impact (Phase 2).** Because classification moved to `brands`,
> the moderation model gains a target: a submission is either a **reclassify**
> (targets a brand → writes `brands` + `edit_history`) or an **outlet edit / new
> outlet** (targets a business). So `submissions` and `edit_history` each get a
> nullable `brand_id` alongside `business_id` (exactly one set), and
> `apply_submission` branches on which is present. A new outlet either references
> an existing brand or creates one in the same transaction. (Detail to finalize
> when Phase 2 UI is built.)

### Table: `submissions` — Phase 2 (the moderation queue)
Users never edit `businesses` directly; they submit here and a moderator applies.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `business_id` | uuid null | FK → `businesses`; null = proposed new business |
| `kind` | `submission_kind` | `new` or `edit` |
| `payload` | jsonb | not null; proposed fields |
| `source` | text | not null; evidence for the claim |
| `note` | text | submitter's comment |
| `submitted_by` | uuid | FK → `profiles`, not null |
| `status` | `submission_status` | not null, default `pending` |
| `reviewed_by` | uuid null | FK → `profiles` |
| `review_note` | text | moderator's reason |
| `created_at` | timestamptz | default now() |
| `reviewed_at` | timestamptz null | |

### Table: `flags` — Phase 2 (report an error)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `business_id` | uuid | FK → `businesses`, not null |
| `reason` | text | not null |
| `detail` | text | |
| `reported_by` | uuid null | FK → `profiles`; **null = anonymous report**. Allowed while the `allowAnonymousFlagging` feature flag is on (see §6.1) |
| `status` | `flag_status` | not null, default `open` |
| `resolved_by` | uuid null | FK → `profiles` |
| `created_at` | timestamptz | default now() |
| `resolved_at` | timestamptz null | |

### Table: `edit_history` — Phase 2 (audit trail / anti-vandalism)
Append-only; written only by the approval function. Powers "last updated" +
accountability.
| Column | Type | Notes |
|---|---|---|
| `id` | bigint identity pk | |
| `business_id` | uuid | FK → `businesses`, not null |
| `field` | text | which column changed |
| `old_value` | text | |
| `new_value` | text | |
| `source` | text | |
| `changed_by` | uuid null | FK → `profiles` |
| `submission_id` | uuid null | FK → `submissions`; what caused the change |
| `changed_at` | timestamptz | default now() |

### Table: `owner_claims` — Phase 4
An owner claims their listing; a moderator verifies before any story is shown.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `business_id` | uuid | FK → `businesses`, not null |
| `claimant_id` | uuid | FK → `profiles`, not null |
| `evidence` | text | how they proved ownership |
| `status` | `claim_status` | not null, default `pending` |
| `reviewed_by` | uuid null | FK → `profiles` |
| `created_at` | timestamptz | default now() |
| `reviewed_at` | timestamptz null | |

### Table: `business_stories` — Phase 4 (opt-in, the ONLY PII table)
Owner story/photo. Personal data is quarantined here with explicit consent, so
the rest of the schema stays out of PDPA scope.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `business_id` | uuid unique | FK → `businesses`; one story per business |
| `owner_id` | uuid | FK → `profiles`, not null |
| `story` | text | |
| `photo_path` | text | path in Supabase Storage (not a raw URL) |
| `consent_given` | boolean | not null, default false |
| `consent_at` | timestamptz null | when consent was recorded |
| `published` | boolean | default false |
| `created_at` / `updated_at` | timestamptz | default now() |

### Design notes
- **Sources stay inline as text** (`*_source`, `submissions.source`) — one source
  per claim is enough for now. Normalize into a `citations` table only if we
  later need multiple sources per claim.
- **`data_source` ≠ `*_source`:** `data_source` = where the *pin* came from;
  `*_source` = evidence for a *classification claim*.
- **`business_stories` is isolated on purpose** — the only table holding PII,
  consent-gated, so the rest of the schema is PDPA-free.
- **`businesses_public` view** flattens `location` into lat/lng and **joins the
  brand** (name, independence, origin, category, subcategory) so the client gets
  each outlet with its brand's classification in one row; `security_invoker`
  means it honours the base tables' RLS. (The app currently reads the table +
  brand directly and decodes EWKB client-side, so the view is optional.)

### Row-Level Security (enforced in DB, not just UI)
Role comes from `profiles.role` (`contributor` | `moderator` | `admin`).
- `anon`: `SELECT` on `businesses` where `status='published'`; `SELECT` on
  `subcategories` and published `business_stories`. `INSERT` on `flags`
  (anonymous report) **only while `allowAnonymousFlagging` is on** (§6.1).
- `contributor` (any authenticated): `INSERT` on `submissions`, `flags`,
  `owner_claims`; read own rows in those tables.
- `moderator` / `admin`: review `submissions` / `flags` / `owner_claims`.
  Applying an approved submission is a Postgres function (SECURITY DEFINER) that
  writes `businesses` **and** `edit_history` in one transaction — the only path
  that mutates live data.
- `admin` only: manage `profiles.role` and `subcategories`.

---

## 5. Data sourcing & seeding

The map is never empty, but ownership is never guessed.

1. **Seed pins** (all `unverified`) for the pilot area:
   - **OpenStreetMap POIs** within the pilot bounding box (`PILOT.bounds`) —
     shops, F&B, services via the Overpass API → import as businesses with
     `osm_id`, category from OSM tags. This is the primary seed for the malls.
     (Implemented in [`scripts/seed-osm.ts`](scripts/seed-osm.ts).)
   - `data.gov.sg` datasets where relevant (e.g. registered food establishments)
     as a supplementary cross-check.
2. **Hand-classify** the pilot set before launch (this is the manual work that
   makes the pilot useful — a spreadsheet → import pipeline).
3. **Crowdsource** everything after launch via `submissions` + moderation.
4. **Owner opt-in** (Phase 4): owners claim a listing and verify it.

Seeding scripts live in `/scripts` and write to Supabase via the service key
(never shipped to the client).

---

## 6. Features by phase

### Phase 0 — Foundations
- Repo scaffold (React + Vite + TS + Tailwind + react-leaflet + vite-plugin-pwa).
- Supabase project, schema + RLS migrations, seed scripts.
- Written classification criteria page.

### Phase 1 — Read-only map (MVP, internal)
- Full-screen Leaflet map, tiles from MapTiler/Stadia (**not** raw OSM tiles).
- Custom markers coloured/badged by classification.
- Filters: independence, origin, category. "Only show classified" toggle.
- **Search bar** — find a business by name (and by building, see below); selecting
  a result flies the map to it and opens its card.
- Detail card (badges, category, source, last-updated).
- **"My location" button** — recentre the map on the user's current GPS position
  (browser Geolocation API; graceful fallback if denied/unavailable).
- **Group shops by building** — tenants that share a building (e.g. Bukit Panjang
  Plaza vs Hillion Mall) collapse into a single **building marker** showing a
  count; tapping it expands to the list of shops inside. Keeps dense malls
  legible instead of a pile of overlapping pins. Building membership comes from
  the `building` field (see §4); at pilot scale it can be derived from which mall
  a point is nearest. (These three — search, locate, building grouping — were
  added to scope 2026-09-04.)
- Map opens centred on the Bukit Panjang malls but works island-wide (no shading/boundary).

### Phase 2 — Crowdsourcing
- Auth (Supabase — email magic link / Google).
- "Suggest a business" + "Suggest an edit" forms (require a source).
- Admin moderation dashboard (approve/reject → applies via DB function).
- Flag/report button (anonymous allowed while the feature flag is on). Edit
  history visible on each card.

### Phase 3 — PWA polish
- Installable, offline caching of tiles + last-viewed data.
- "Near me" geolocation, distance sort.

### Phase 4 — Growth
- Owner-claim & verification, opt-in owner story/photos (PDPA consent flow).
- Contributor leaderboard / gamification.

### 6.1 Feature flags
Toggleable behaviours live in one place (`src/config/features.ts`):
- **`allowAnonymousFlagging`** (default **on**): logged-out users may report an
  error (`flags.reported_by` = null). Lowers the barrier to reporting; can be
  flipped off if abused. The client flag drives the UI; disabling it must also
  be enforced by the `flags` RLS policy (a client flag is not a security
  boundary). To toggle at runtime without a redeploy, promote this to the
  `app_settings` table read by both the app and the policy.

---

## 7. UX sketch

**Main screen:** map fills the viewport. Top: search bar + filter chips
(`🧍 Independent`, `🇸🇬 Local`, category). A **"my location"** control (⌖) sits
over the map to recentre on the user. Bottom sheet slides up on marker tap.

**Markers:** individual shops show colour = origin (green local / grey
unverified / amber foreign); icon = category; a small badge for independence.
Shops in the same **building** collapse into one **building marker** with a
tenant count; tapping expands to the list of shops inside (so a mall reads as one
pin, not fifty).

**Search:** a name/building search; picking a result flies to it and opens the
card (or the building's shop list).

**Detail card:** name · category · two big badges · source line ("Classified by
community, source: …, updated 2026-08") · "Report an error" · (Phase 4) owner
story.

Full wireframes to be produced as a separate design pass before Phase 1 UI work.

---

## 8. Architecture

```
Browser (PWA: React + Vite + Leaflet)
        │  supabase-js (anon key, RLS-protected)
        ▼
Supabase
  ├─ Postgres + PostGIS  (businesses, submissions, flags, edit_history)
  ├─ Auth                (contributors, admins)
  └─ Storage             (owner photos, Phase 4)
        ▲
Seed/admin scripts (/scripts, service key — server-side only)
        ▲
Sources: OpenStreetMap (Overpass) · data.gov.sg · manual curation
```

- **Secrets:** only the Supabase *anon* key ships to the client; RLS is the real
  security boundary. Service key stays in server-side scripts.

### 8.1 Tile strategy — must be trivially swappable

Tiles are the one "OpenStreetMap" cost. The **map data** (OSM, ODbL) is free; the
**tile hosting** (rendering + bandwidth) is the paid part. The design goal here
is that the tile source is **a single config value we can change without touching
map/UI code** — so we can move between providers, or from hosted to self-hosted,
as cost/scale demands, with a one-line change and no refactor.

**Swappability contract (build to this):**
- A single module owns tiles: `/src/map/tileSource.ts`, driven **only** by env
  vars — never hard-coded in components:
  - `VITE_TILE_URL` — the `{z}/{x}/{y}` URL template (or `.pmtiles` URL).
  - `VITE_TILE_KIND` — `raster` | `vector`.
  - `VITE_TILE_API_KEY`, `VITE_TILE_ATTRIBUTION`.
- The map component consumes that module and nothing else, so switching provider
  = change env vars + redeploy. Changing raster→vector is contained to this one
  module (it selects `L.tileLayer` vs a MapLibre GL layer).
- **No component ever hard-codes a tile URL.** Enforced in review.

**Provider ladder (all reachable through the same contract, cheapest first):**
1. **Dev only:** raw OSM raster — fine locally, ⚠️ never in production
   (`tile.openstreetmap.org` usage policy forbids app-scale use).
2. **Pilot launch:** MapTiler or Stadia Maps free tier (~100k–200k/mo free) +
   PWA service-worker tile caching. For one small area this is effectively **$0**
   and needs only env vars.
3. **Island-wide / growth:** self-hosted **Protomaps `.pmtiles`** (a single
   vector file on static hosting, e.g. Cloudflare R2) — decouples cost from user
   count, ~$0 marginal. Reached by pointing the same env vars at the `.pmtiles`
   URL and setting `VITE_TILE_KIND=vector`.

Because everything routes through `tileSource.ts` + env vars, we can start on a
free hosted tier and later self-host **without rewriting the map**.

---

## 9. Trust, moderation & anti-abuse
- Nothing goes live without moderation (submissions queue).
- Every classification shows its **source** and **last-updated** date.
- **Flag/report** on every card; `edit_history` gives an audit trail.
- Misinformation risk (falsely tagging a competitor "foreign") is mitigated by:
  source requirement + moderation + edit history + community flagging.

## 10. Privacy & legal (Singapore PDPA)
- v1 stores **no personal data about owners** — only business attributes. This
  keeps us out of PDPA scope for owner data.
- Contributor accounts (emails) *are* personal data → privacy policy + consent
  needed at Phase 2.
- Owner stories (Phase 4) require explicit **opt-in consent** and a way to
  withdraw / take down.
- Respect data-source licences: OSM data is ODbL (attribution + share-alike on
  derived data); data.gov.sg has its own terms. Attribution shown in-app.

## 11. Open decisions
- ~~Confirm pilot neighbourhood~~ → **✅ Bukit Panjang Plaza + Hillion Mall**
  (2026-09-04), with seeding confined to the two malls (`PILOT.bounds`).
- **[DECIDE]** Starting tile provider: MapTiler vs Stadia (both free tiers).
  Low stakes — the tile source is env-var-swappable (see §8.1), so this is a
  starting point, not a lock-in.
- **[DECIDE later]** Editorial stance on a franchise's origin — a locally-owned
  franchisee of a foreign brand: `origin = local` or `foreign`? (Independence is
  always `franchise` regardless; this is purely an Axis-B question now.)
- ~~Introduce a `brands` table?~~ → **✅ Standardized (2026-09): every business
  belongs to a brand; classification lives on the brand.** Independent single
  stores are brands with one outlet (§3, §4). Migration + backfill of the 67
  seeded rows still to be applied.
- ~~Anonymous flagging?~~ → **✅ Allowed for now**, behind the
  `allowAnonymousFlagging` feature flag so it can be disabled (§6.1).
- ~~App name~~ → **Placeholder "StallOrigins"**, centralized in
  `brand.config.ts` for a one-file rename later.
