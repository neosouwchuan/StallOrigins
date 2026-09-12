-- StallOrigins — 07: standardize on brands (SPEC §3, §4)
-- Every business becomes an OUTLET that belongs to exactly one brand.
-- Classification (independence / origin / sources / category / subcategory /
-- website) moves from `businesses` to a new `brands` table, so it is set once
-- per brand and applies to every outlet. Independent single stores are simply
-- brands with one outlet. Existing rows are backfilled.
set search_path = public, extensions;

-- 0. `building` column (was planned) — needed by the outlet + view below.
alter table public.businesses add column if not exists building text;

-- 0b. Backfill `building` by nearest mall centre for outlets within the pilot
--     (points >500 m from both malls are left null — they are outside the pilot).
update public.businesses
set building = case
  when ST_Distance(location, ST_SetSRID(ST_MakePoint(103.7627, 1.3786), 4326)::geography)
     <= ST_Distance(location, ST_SetSRID(ST_MakePoint(103.7639, 1.3782), 4326)::geography)
  then 'Bukit Panjang Plaza' else 'Hillion Mall' end
where building is null
  and (ST_DWithin(location, ST_SetSRID(ST_MakePoint(103.7627, 1.3786), 4326)::geography, 500)
    or ST_DWithin(location, ST_SetSRID(ST_MakePoint(103.7639, 1.3782), 4326)::geography, 500));

-- 1. brands ------------------------------------------------------------------
create table if not exists public.brands (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null unique,
  category             business_category  not null,
  subcategory_id       text references public.subcategories (id),
  independence         independence_level not null default 'unverified',
  origin               origin_level       not null default 'unverified',
  independence_source  text,
  origin_source        text,
  website              text,
  created_by           uuid references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint brand_independence_needs_source
    check (independence = 'unverified' or independence_source is not null),
  constraint brand_origin_needs_source
    check (origin = 'unverified' or origin_source is not null)
);
create index if not exists brands_category_idx on public.brands (category);
create index if not exists brands_origin_idx on public.brands (origin);
create index if not exists brands_independence_idx on public.brands (independence);

drop trigger if exists trg_brands_updated_at on public.brands;
create trigger trg_brands_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

-- 2. drop the view that references the columns we are about to move ----------
drop view if exists public.businesses_public;

-- 3. backfill brands from existing businesses (dedupe by name) ---------------
insert into public.brands (name, category, subcategory_id, independence, origin,
                           independence_source, origin_source, website)
select distinct on (name)
       name, category, subcategory_id, independence, origin,
       independence_source, origin_source, website
from public.businesses
order by name, id
on conflict (name) do nothing;

-- 4. link businesses -> brands ----------------------------------------------
alter table public.businesses add column if not exists brand_id uuid;
update public.businesses b
   set brand_id = br.id
  from public.brands br
 where br.name = b.name;

alter table public.businesses alter column brand_id set not null;
alter table public.businesses
  add constraint businesses_brand_id_fkey
  foreign key (brand_id) references public.brands (id);
create index if not exists businesses_brand_idx on public.businesses (brand_id);

-- 5. drop the moved columns (drops their CHECKs + indexes automatically) -----
alter table public.businesses
  drop column if exists category,
  drop column if exists subcategory_id,
  drop column if exists independence,
  drop column if exists origin,
  drop column if exists independence_source,
  drop column if exists origin_source,
  drop column if exists website;
-- outlet `name` is now an optional branch label (defaults to the brand name)
alter table public.businesses alter column name drop not null;

-- 6. moderation can now target a brand (reclassify) OR a business (outlet) ---
alter table public.submissions  add column if not exists brand_id uuid references public.brands (id);
alter table public.edit_history add column if not exists brand_id uuid references public.brands (id);

-- A history row now targets a brand (classification change) OR a business
-- (outlet change), so business_id is no longer mandatory — but at least one
-- target must be set.
alter table public.edit_history alter column business_id drop not null;
alter table public.edit_history add constraint edit_history_target
  check (business_id is not null or brand_id is not null);

alter table public.submissions drop constraint if exists submission_kind_shape;
alter table public.submissions add constraint submission_shape check (
  (kind = 'new'  and business_id is null)
  or (kind = 'edit' and (business_id is not null or brand_id is not null))
);

-- 7. brands RLS: world-readable; moderators manage --------------------------
grant select on public.brands to anon, authenticated;
grant insert, update on public.brands to authenticated;   -- gated by policy
alter table public.brands enable row level security;
create policy brands_select on public.brands
  for select to anon, authenticated using (true);
create policy brands_mod_write on public.brands
  for all to authenticated using (public.is_moderator()) with check (public.is_moderator());

-- 8. recreate the client read view with the brand join ----------------------
create or replace view public.businesses_public
with (security_invoker = true) as
select
  b.id,
  coalesce(b.name, br.name)   as name,
  ST_Y(b.location::geometry)  as lat,
  ST_X(b.location::geometry)  as lng,
  b.address,
  b.postal_code,
  b.building,
  b.brand_id,
  br.name                     as brand_name,
  br.category,
  br.subcategory_id,
  sc.label                    as subcategory_label,
  br.independence,
  br.origin,
  br.independence_source,
  br.origin_source,
  br.website,
  b.data_source,
  b.status,
  b.updated_at
from public.businesses b
join public.brands br on br.id = b.brand_id
left join public.subcategories sc on sc.id = br.subcategory_id;
grant select on public.businesses_public to anon, authenticated;

-- 9. brand-aware apply_submission -------------------------------------------
-- A submission is a NEW outlet, a RECLASSIFY (brand_id set), or an OUTLET EDIT
-- (business_id set). Classification writes go to `brands`; outlet writes go to
-- `businesses`; both log to `edit_history` in the same transaction.
create or replace function public.apply_submission(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s        public.submissions;
  p        jsonb;
  v_actor  uuid := auth.uid();
  v_bid    uuid;
  v_brand  uuid;
  ob       public.brands;
  nb       public.brands;
  obiz     public.businesses;
  nbiz     public.businesses;
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can apply submissions';
  end if;

  select * into s from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'Submission % not found', p_submission_id; end if;
  if s.status <> 'pending' then raise exception 'Submission % is already %', s.id, s.status; end if;
  p := s.payload;

  if s.kind = 'new' then
    -- resolve or create the brand by name, then create the outlet
    v_brand := (select id from public.brands where name = coalesce(p ->> 'brand_name', p ->> 'name'));
    if v_brand is null then
      insert into public.brands (name, category, subcategory_id, independence, origin,
                                 independence_source, origin_source, website, created_by)
      values (
        coalesce(p ->> 'brand_name', p ->> 'name'),
        (p ->> 'category')::business_category,
        p ->> 'subcategory_id',
        coalesce((p ->> 'independence')::independence_level, 'unverified'),
        coalesce((p ->> 'origin')::origin_level, 'unverified'),
        p ->> 'independence_source', p ->> 'origin_source', p ->> 'website', s.submitted_by
      )
      returning id into v_brand;
    end if;

    insert into public.businesses (brand_id, name, location, address, postal_code, building,
                                   osm_id, data_source, created_by)
    values (
      v_brand, p ->> 'name',
      ST_SetSRID(ST_MakePoint((p ->> 'lng')::float8, (p ->> 'lat')::float8), 4326)::geography,
      p ->> 'address', p ->> 'postal_code', p ->> 'building', p ->> 'osm_id',
      coalesce(p ->> 'data_source', 'community'), s.submitted_by
    )
    returning id into v_bid;

    insert into public.edit_history (business_id, brand_id, field, old_value, new_value, source, changed_by, submission_id)
    values (v_bid, v_brand, '*', null, 'created', s.source, v_actor, s.id);

  elsif s.brand_id is not null then
    -- reclassify a brand
    v_brand := s.brand_id;
    select * into ob from public.brands where id = v_brand for update;
    if not found then raise exception 'Brand % not found', v_brand; end if;

    update public.brands set
      independence        = case when p ? 'independence'        then (p ->> 'independence')::independence_level else independence end,
      origin              = case when p ? 'origin'              then (p ->> 'origin')::origin_level else origin end,
      independence_source = case when p ? 'independence_source' then p ->> 'independence_source' else independence_source end,
      origin_source       = case when p ? 'origin_source'       then p ->> 'origin_source' else origin_source end,
      category            = case when p ? 'category'            then (p ->> 'category')::business_category else category end,
      subcategory_id      = case when p ? 'subcategory_id'      then p ->> 'subcategory_id' else subcategory_id end,
      website             = case when p ? 'website'             then p ->> 'website' else website end,
      name                = case when p ? 'name'                then p ->> 'name' else name end
    where id = v_brand
    returning * into nb;

    if nb.independence is distinct from ob.independence then
      insert into public.edit_history (brand_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_brand, 'independence', ob.independence::text, nb.independence::text, s.source, v_actor, s.id); end if;
    if nb.origin is distinct from ob.origin then
      insert into public.edit_history (brand_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_brand, 'origin', ob.origin::text, nb.origin::text, s.source, v_actor, s.id); end if;
    if nb.name is distinct from ob.name then
      insert into public.edit_history (brand_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_brand, 'name', ob.name, nb.name, s.source, v_actor, s.id); end if;

  else
    -- outlet edit (location / address / branch label)
    v_bid := s.business_id;
    select * into obiz from public.businesses where id = v_bid for update;
    if not found then raise exception 'Business % not found', v_bid; end if;

    update public.businesses set
      name        = case when p ? 'name'        then p ->> 'name' else name end,
      address     = case when p ? 'address'     then p ->> 'address' else address end,
      postal_code = case when p ? 'postal_code' then p ->> 'postal_code' else postal_code end,
      building    = case when p ? 'building'    then p ->> 'building' else building end,
      location    = case when (p ? 'lat' and p ? 'lng')
                         then ST_SetSRID(ST_MakePoint((p ->> 'lng')::float8, (p ->> 'lat')::float8), 4326)::geography
                         else location end
    where id = v_bid
    returning * into nbiz;

    if nbiz.name is distinct from obiz.name then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'name', obiz.name, nbiz.name, s.source, v_actor, s.id); end if;
    if not ST_Equals(nbiz.location::geometry, obiz.location::geometry) then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'location', ST_AsText(obiz.location::geometry), ST_AsText(nbiz.location::geometry), s.source, v_actor, s.id); end if;
  end if;

  update public.submissions
    set status = 'approved', reviewed_by = v_actor, reviewed_at = now()
    where id = s.id;
  update public.profiles
    set contributions_count = contributions_count + 1
    where id = s.submitted_by;

  return coalesce(v_bid, v_brand);
end;
$$;
