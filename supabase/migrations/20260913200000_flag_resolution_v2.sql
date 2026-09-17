-- StallOrigins — 15: resolve_flag hardening.
-- (1) Require a non-empty resolution note (was UI-only).
-- (2) Allow repositioning the flagged outlet: lat/lng in p_changes move the pin
--     (which also re-derives building_id via the set_building_id trigger).
set search_path = public, extensions;

create or replace function public.resolve_flag(
  p_flag_id uuid,
  p_status  flag_status,
  p_changes jsonb default '{}'::jsonb,
  p_note    text default null
) returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  f        public.flags;
  p        jsonb := coalesce(p_changes, '{}'::jsonb);
  v_actor  uuid := auth.uid();
  obiz     public.businesses;
  nbiz     public.businesses;
  v_edit   bigint;
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can resolve flags';
  end if;
  if p_status not in ('resolved','dismissed') then
    raise exception 'A flag can only be resolved or dismissed';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'A resolution note is required';
  end if;

  select * into f from public.flags where id = p_flag_id for update;
  if not found then raise exception 'Flag % not found', p_flag_id; end if;
  if f.status <> 'open' then raise exception 'Flag % is already %', f.id, f.status; end if;

  if p_status = 'resolved' and p != '{}'::jsonb then
    select * into obiz from public.businesses where id = f.business_id for update;
    if not found then raise exception 'Business % not found', f.business_id; end if;

    update public.businesses set
      name        = case when p ? 'name'        then p ->> 'name' else name end,
      unit        = case when p ? 'unit'        then p ->> 'unit' else unit end,
      address     = case when p ? 'address'     then p ->> 'address' else address end,
      postal_code = case when p ? 'postal_code' then p ->> 'postal_code' else postal_code end,
      status      = case when p ? 'status'      then (p ->> 'status')::business_status else status end,
      location    = case when (p ? 'lat' and p ? 'lng')
                         then ST_SetSRID(ST_MakePoint((p ->> 'lng')::float8, (p ->> 'lat')::float8), 4326)::geography
                         else location end
    where id = f.business_id
    returning * into nbiz;

    if nbiz.name is distinct from obiz.name then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, flag_id)
      values (f.business_id, 'name', obiz.name, nbiz.name, 'flag', v_actor, f.id) returning id into v_edit; end if;
    if nbiz.unit is distinct from obiz.unit then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, flag_id)
      values (f.business_id, 'unit', obiz.unit, nbiz.unit, 'flag', v_actor, f.id) returning id into v_edit; end if;
    if nbiz.address is distinct from obiz.address then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, flag_id)
      values (f.business_id, 'address', obiz.address, nbiz.address, 'flag', v_actor, f.id) returning id into v_edit; end if;
    if nbiz.status is distinct from obiz.status then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, flag_id)
      values (f.business_id, 'status', obiz.status::text, nbiz.status::text, 'flag', v_actor, f.id) returning id into v_edit; end if;
    if not ST_Equals(nbiz.location::geometry, obiz.location::geometry) then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, flag_id)
      values (f.business_id, 'location', ST_AsText(obiz.location::geometry), ST_AsText(nbiz.location::geometry), 'flag', v_actor, f.id) returning id into v_edit; end if;
  end if;

  update public.flags set
    status = p_status,
    resolved_by = v_actor,
    resolved_at = now(),
    resolution_note = p_note,
    resolution_edit_id = v_edit
  where id = f.id;

  return v_edit;
end;
$$;

grant execute on function public.resolve_flag(uuid, flag_status, jsonb, text) to authenticated;
