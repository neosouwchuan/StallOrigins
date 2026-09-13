-- StallOrigins — 10: buildings as polygons; membership by containment (SPEC §4/§6).
-- A building (a mall, for now) is a boundary polygon. A stall belongs to the
-- building whose polygon covers its location. This replaces the interim
-- `businesses.building` text (nearest-mall) with a real `buildings` table and a
-- derived `building_id`.
set search_path = public, extensions;

create table if not exists public.buildings (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  kind     text not null default 'mall',
  boundary geography(Polygon, 4326) not null
);
create index if not exists buildings_boundary_gix on public.buildings using gist (boundary);

grant select on public.buildings to anon, authenticated;
alter table public.buildings enable row level security;
create policy buildings_select on public.buildings
  for select to anon, authenticated using (true);
create policy buildings_admin_write on public.buildings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Seed the two pilot malls as approximate footprint polygons (refine later).
-- Polygon rings are sequential lng/lat coordinates, closed (first = last).
insert into public.buildings (name, kind, boundary) values
  ('Bukit Panjang Plaza', 'mall',
   ST_SetSRID(ST_GeomFromText('POLYGON((103.7616 1.3780,103.7632 1.3780,103.7632 1.3796,103.7616 1.3796,103.7616 1.3780))'), 4326)::geography),
  ('Hillion Mall', 'mall',
   ST_SetSRID(ST_GeomFromText('POLYGON((103.7632 1.3776,103.7649 1.3776,103.7649 1.3792,103.7632 1.3792,103.7632 1.3776))'), 4326)::geography);

-- Membership: the building whose polygon covers a point.
create or replace function public.building_for(pt geography)
returns uuid language sql stable set search_path = public, extensions as $$
  select id from public.buildings where ST_Covers(boundary, pt) limit 1;
$$;

alter table public.businesses add column if not exists building_id uuid
  references public.buildings (id);

-- Keep building_id in sync with the stall's location.
create or replace function public.set_building_id()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  new.building_id := public.building_for(new.location);
  return new;
end;
$$;
drop trigger if exists trg_business_building on public.businesses;
create trigger trg_business_building
  before insert or update of location on public.businesses
  for each row execute function public.set_building_id();

-- Backfill existing outlets by containment.
update public.businesses set building_id = public.building_for(location);
create index if not exists businesses_building_idx on public.businesses (building_id);

-- Replace the old text `building` column; rebuild the view with the building join.
drop view if exists public.businesses_public;
alter table public.businesses drop column if exists building;

create or replace view public.businesses_public
with (security_invoker = true) as
select
  b.id,
  coalesce(b.name, br.name)   as name,
  ST_Y(b.location::geometry)  as lat,
  ST_X(b.location::geometry)  as lng,
  b.address,
  b.postal_code,
  b.building_id,
  bld.name                    as building,
  b.brand_id,
  br.name                     as brand_name,
  br.category,
  br.subcategory_id,
  sc.label                    as subcategory_label,
  br.independence,
  br.independence_source,
  br.origin_country,
  c.name                      as origin_country_name,
  br.origin_source,
  br.website,
  b.data_source,
  b.status,
  b.updated_at
from public.businesses b
join public.brands br on br.id = b.brand_id
left join public.subcategories sc on sc.id = br.subcategory_id
left join public.countries c on c.code = br.origin_country
left join public.buildings bld on bld.id = b.building_id;
grant select on public.businesses_public to anon, authenticated;

-- apply_submission: drop `building` handling (building_id is derived by trigger).
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
    v_brand := (select id from public.brands where name = coalesce(p ->> 'brand_name', p ->> 'name'));
    if v_brand is null then
      insert into public.brands (name, category, subcategory_id, independence,
                                 independence_source, origin_country, origin_source, website, created_by)
      values (
        coalesce(p ->> 'brand_name', p ->> 'name'),
        (p ->> 'category')::business_category,
        p ->> 'subcategory_id',
        coalesce((p ->> 'independence')::independence_level, 'unverified'),
        p ->> 'independence_source',
        p ->> 'origin_country',
        p ->> 'origin_source', p ->> 'website', s.submitted_by
      )
      returning id into v_brand;
    end if;

    insert into public.businesses (brand_id, name, location, address, postal_code,
                                   osm_id, data_source, created_by)
    values (
      v_brand, p ->> 'name',
      ST_SetSRID(ST_MakePoint((p ->> 'lng')::float8, (p ->> 'lat')::float8), 4326)::geography,
      p ->> 'address', p ->> 'postal_code', p ->> 'osm_id',
      coalesce(p ->> 'data_source', 'community'), s.submitted_by
    )
    returning id into v_bid;

    insert into public.edit_history (business_id, brand_id, field, old_value, new_value, source, changed_by, submission_id)
    values (v_bid, v_brand, '*', null, 'created', s.source, v_actor, s.id);

  elsif s.brand_id is not null then
    v_brand := s.brand_id;
    select * into ob from public.brands where id = v_brand for update;
    if not found then raise exception 'Brand % not found', v_brand; end if;

    update public.brands set
      independence        = case when p ? 'independence'        then (p ->> 'independence')::independence_level else independence end,
      independence_source = case when p ? 'independence_source' then p ->> 'independence_source' else independence_source end,
      origin_country      = case when p ? 'origin_country'      then p ->> 'origin_country' else origin_country end,
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
    if nb.origin_country is distinct from ob.origin_country then
      insert into public.edit_history (brand_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_brand, 'origin_country', ob.origin_country, nb.origin_country, s.source, v_actor, s.id); end if;
    if nb.name is distinct from ob.name then
      insert into public.edit_history (brand_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_brand, 'name', ob.name, nb.name, s.source, v_actor, s.id); end if;

  else
    v_bid := s.business_id;
    select * into obiz from public.businesses where id = v_bid for update;
    if not found then raise exception 'Business % not found', v_bid; end if;

    update public.businesses set
      name        = case when p ? 'name'        then p ->> 'name' else name end,
      address     = case when p ? 'address'     then p ->> 'address' else address end,
      postal_code = case when p ? 'postal_code' then p ->> 'postal_code' else postal_code end,
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

  update public.submissions set status = 'approved', reviewed_by = v_actor, reviewed_at = now() where id = s.id;
  update public.profiles set contributions_count = contributions_count + 1 where id = s.submitted_by;
  return coalesce(v_bid, v_brand);
end;
$$;
