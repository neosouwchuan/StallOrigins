-- StallOrigins — 02: tables (SPEC §4)
-- No `coverage_areas` table by design: coverage is island-wide and incomplete
-- is acceptable (SPEC §2).

-- Ensure the geography type + ST_* resolve whether PostGIS is in public or
-- the extensions schema.
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- profiles — extends Supabase auth.users with app data
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  display_name         text,
  role                 user_role   not null default 'contributor',
  contributions_count  integer     not null default 0,
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- app_settings — runtime-toggleable feature flags (SPEC §6.1)
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key         text primary key,
  enabled     boolean     not null default false,
  description text,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- subcategories — lookup so subcategories stay consistent (no free-text drift)
-- ---------------------------------------------------------------------------
create table if not exists public.subcategories (
  id       text primary key,             -- slug, e.g. 'hawker_stall'
  category business_category not null,
  label    text not null
);

-- ---------------------------------------------------------------------------
-- businesses — the live data
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  location             geography(Point, 4326) not null,
  address              text,
  postal_code          text,
  category             business_category  not null,
  subcategory_id       text references public.subcategories (id),
  independence         independence_level not null default 'unverified',
  origin               origin_level       not null default 'unverified',
  independence_source  text,
  origin_source        text,
  website              text,
  osm_id               text unique,
  -- Where the PIN came from (distinct from *_source, which is evidence for a
  -- classification claim).
  data_source          text not null default 'manual'
                         check (data_source in ('osm','datagovsg','manual','community')),
  status               business_status not null default 'published',
  created_by           uuid references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- A non-unverified classification MUST cite a source.
  constraint independence_needs_source
    check (independence = 'unverified' or independence_source is not null),
  constraint origin_needs_source
    check (origin = 'unverified' or origin_source is not null)
);

create index if not exists businesses_location_gix on public.businesses using gist (location);
create index if not exists businesses_category_idx on public.businesses (category);
create index if not exists businesses_origin_idx on public.businesses (origin);
create index if not exists businesses_independence_idx on public.businesses (independence);
create index if not exists businesses_status_idx on public.businesses (status);

-- ---------------------------------------------------------------------------
-- submissions — the moderation queue (users write here, never to businesses)
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid references public.businesses (id) on delete cascade,
  kind         submission_kind not null,
  payload      jsonb not null,
  source       text  not null,
  note         text,
  submitted_by uuid  not null references public.profiles (id),
  status       submission_status not null default 'pending',
  reviewed_by  uuid references public.profiles (id),
  review_note  text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  -- 'new' proposes a business (no id yet); 'edit' targets an existing one.
  constraint submission_kind_shape check (
    (kind = 'new'  and business_id is null) or
    (kind = 'edit' and business_id is not null)
  )
);

create index if not exists submissions_status_idx on public.submissions (status);
create index if not exists submissions_business_idx on public.submissions (business_id);
create index if not exists submissions_submitter_idx on public.submissions (submitted_by);

-- ---------------------------------------------------------------------------
-- flags — "report an error" (reported_by null = anonymous report; SPEC §6.1)
-- ---------------------------------------------------------------------------
create table if not exists public.flags (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  reason      text not null,
  detail      text,
  reported_by uuid references public.profiles (id),
  status      flag_status not null default 'open',
  resolved_by uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists flags_status_idx on public.flags (status);
create index if not exists flags_business_idx on public.flags (business_id);

-- ---------------------------------------------------------------------------
-- edit_history — append-only audit trail (written only by apply_submission)
-- ---------------------------------------------------------------------------
create table if not exists public.edit_history (
  id            bigint generated always as identity primary key,
  business_id   uuid not null references public.businesses (id) on delete cascade,
  field         text not null,
  old_value     text,
  new_value     text,
  source        text,
  changed_by    uuid references public.profiles (id),
  submission_id uuid references public.submissions (id) on delete set null,
  changed_at    timestamptz not null default now()
);

create index if not exists edit_history_business_idx on public.edit_history (business_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- owner_claims — an owner claims their listing; a moderator verifies (Phase 4)
-- ---------------------------------------------------------------------------
create table if not exists public.owner_claims (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id),
  evidence    text,
  status      claim_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists owner_claims_business_idx on public.owner_claims (business_id);
create index if not exists owner_claims_claimant_idx on public.owner_claims (claimant_id);

-- ---------------------------------------------------------------------------
-- business_stories — opt-in owner content; the ONLY PII table (Phase 4)
-- ---------------------------------------------------------------------------
create table if not exists public.business_stories (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null unique references public.businesses (id) on delete cascade,
  owner_id      uuid not null references public.profiles (id),
  story         text,
  photo_path    text,                    -- Supabase Storage path, not a raw URL
  consent_given boolean not null default false,
  consent_at    timestamptz,
  published     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Cannot publish a story without recorded consent.
  constraint story_publish_requires_consent
    check (not published or consent_given)
);
