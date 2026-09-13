# Supabase — database migrations

Schema for StallOrigins (see [../SPEC.md](../SPEC.md) §4). Migrations run in
filename order.

| # | File | Contents |
|---|---|---|
| 01 | `20260904120000_extensions_and_enums.sql` | PostGIS + all enum types |
| 02 | `20260904120100_tables.sql` | All 9 tables + `app_settings`, constraints, indexes |
| 03 | `20260904120200_functions.sql` | Triggers, role/feature helpers, `apply_submission`, `reject_submission` |
| 04 | `20260904120300_rls.sql` | Grants + Row-Level Security policies |
| 05 | `20260904120400_reference_data.sql` | Feature-flag defaults + subcategory lookup |
| 06 | `20260904120500_views.sql` | `businesses_public` read view (flat lat/lng + labels) |
| 07 | `20260913120000_brands.sql` | **Standardize on brands** — new `brands` table holds classification; `businesses` become outlets with `brand_id`; backfills existing rows (dedupe by name); adds `building`; brand-aware `apply_submission`; rebuilds the view with a brand join |
| 08 | `20260913130000_origin_countries.sql` | **Origin by country** — adds the `countries` reference table (ISO 3166-1), replaces `brands.origin` enum with `origin_country` FK (auto-migrates `local`→`SG`), rebuilds the view + `apply_submission` |
| 09 | `20260913140000_merge_chain.sql` | Merge `chain_small` into `chain` (folds existing rows) |
| — | `seed.sql` | DEV-only sample brands + outlets (loaded by `supabase db reset`) |

## Running locally

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then:

```bash
supabase init          # first time only, if no config yet
supabase start         # local Postgres + Auth in Docker
supabase db reset      # applies all migrations, then seed.sql
```

To push to a hosted project:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

## Validation status

✅ All five migrations + `seed.sql` have been run on a local **PostGIS 16**
container with small shims for the Supabase-only bits (`auth` schema, `auth.uid()`,
and the `anon`/`authenticated` roles). Verified end-to-end:
- source-required CHECK constraints reject unsourced classifications;
- `apply_submission` is moderator-gated, creates/edits the business, logs only
  the fields that actually changed to `edit_history`, marks the submission
  approved, and credits the contributor;
- `reject_submission` works; the `allow_anonymous_flagging` flag reads back true.

Still recommended: run `supabase db reset` once against a real Supabase instance,
since the shims stand in for Supabase's actual `auth` schema and JWT-backed
`auth.uid()`.

## Bootstrapping the first admin

New sign-ups get `role = 'contributor'`. The `prevent_role_change` trigger only
allows role changes by an existing admin — **except** when there is no admin yet
or the change is made without a user context (service-role key / SQL editor).
So promote your first admin directly, e.g. in the SQL editor:

```sql
update public.profiles set role = 'admin' where id = '<your-auth-user-id>';
```

After that, admins manage roles from within the app.

## Notes
- The **only** path that mutates live `businesses` is `apply_submission()`,
  which also writes `edit_history` in the same transaction. Normal users can
  only INSERT into `submissions` / `flags` / `owner_claims`.
- Anonymous flagging is governed by the `allow_anonymous_flagging` row in
  `app_settings`; flip `enabled` to turn it off at runtime (no redeploy).
- If PostGIS installs into the `extensions` schema (Supabase default), the
  functions and table DDL already keep `extensions` on the search_path.
