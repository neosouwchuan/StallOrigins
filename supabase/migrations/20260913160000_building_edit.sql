-- StallOrigins — 11: admin building-boundary editing (SPEC §6).
-- Expose each building's polygon as GeoJSON for the editor, and a function to
-- recompute stall→building membership after a boundary changes (the per-row
-- location trigger doesn't fire when a building polygon moves).
set search_path = public, extensions;

create or replace view public.buildings_public
with (security_invoker = true) as
select
  id,
  name,
  kind,
  ST_AsGeoJSON(boundary::geometry) as geojson
from public.buildings;
grant select on public.buildings_public to anon, authenticated;

-- Re-derive building_id for every outlet by containment. Admin only.
create or replace function public.recompute_building_membership()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare n integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can recompute building membership';
  end if;
  update public.businesses set building_id = public.building_for(location);
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.recompute_building_membership() to authenticated;
