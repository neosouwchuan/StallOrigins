-- StallOrigins — 01: extensions + enum types
-- Enums model the classification axes and workflow states (SPEC §4.0) so bad
-- values are impossible at the DB level.

-- PostGIS for geography(Point) columns and spatial queries.
-- On Supabase this typically lands in the `extensions` schema; on a vanilla
-- Postgres it lands in `public`. Functions/DDL below keep `extensions` on the
-- search_path so the `geography` type and ST_* functions resolve either way.
create extension if not exists postgis;

do $$
begin
  -- Axis A — independence (structure / scale ONLY; no local/foreign here).
  if not exists (select 1 from pg_type where typname = 'independence_level') then
    create type independence_level as enum
      ('independent', 'chain_small', 'chain', 'franchise', 'unverified');
  end if;

  -- Axis B — ownership origin (local vs foreign).
  if not exists (select 1 from pg_type where typname = 'origin_level') then
    create type origin_level as enum ('local', 'foreign', 'unverified');
  end if;

  if not exists (select 1 from pg_type where typname = 'business_category') then
    create type business_category as enum ('fnb', 'retail', 'services');
  end if;

  if not exists (select 1 from pg_type where typname = 'business_status') then
    create type business_status as enum ('published', 'hidden');
  end if;

  if not exists (select 1 from pg_type where typname = 'submission_kind') then
    create type submission_kind as enum ('new', 'edit');
  end if;

  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type submission_status as enum ('pending', 'approved', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'flag_status') then
    create type flag_status as enum ('open', 'resolved', 'dismissed');
  end if;

  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('contributor', 'moderator', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'claim_status') then
    create type claim_status as enum ('pending', 'verified', 'rejected');
  end if;
end
$$;
