-- StallOrigins — 12: fix recompute_building_membership for safe-update.
-- Supabase blocks UPDATE without a WHERE clause. Add one (which also makes the
-- recompute touch only the rows whose building actually changed).
set search_path = public, extensions;

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
  update public.businesses
    set building_id = public.building_for(location)
    where building_id is distinct from public.building_for(location);
  get diagnostics n = row_count;
  return n;
end;
$$;
