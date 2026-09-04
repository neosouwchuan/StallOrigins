-- StallOrigins — 03: functions & triggers
-- The approval function is the ONLY path that mutates live `businesses`, and it
-- writes `edit_history` in the same transaction (SPEC §4, §9).

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER: bypass RLS to read profiles safely)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- Feature flags (SPEC §6.1) — read by the app AND by RLS policies
-- ---------------------------------------------------------------------------
create or replace function public.feature_enabled(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select enabled from public.app_settings where key = p_key),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_businesses_updated_at on public.businesses;
create trigger trg_businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

drop trigger if exists trg_stories_updated_at on public.business_stories;
create trigger trg_stories_updated_at
  before update on public.business_stories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Prevent privilege escalation: only admins may change a role.
-- Bootstrap escape hatch: allowed when there is no admin yet, or when acting
-- without a user context (service-role key / raw SQL, where auth.uid() is null).
-- ---------------------------------------------------------------------------
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and not public.is_admin()
     and auth.uid() is not null
     and exists (select 1 from public.profiles where role = 'admin')
  then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_change on public.profiles;
create trigger trg_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ---------------------------------------------------------------------------
-- apply_submission — approve a pending submission and apply it atomically.
-- Only moderators/admins may call it. Returns the affected business id.
-- ---------------------------------------------------------------------------
create or replace function public.apply_submission(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s           public.submissions;
  p           jsonb;
  v_actor     uuid := auth.uid();
  v_bid       uuid;
  b           public.businesses;   -- old row
  nb          public.businesses;   -- new row
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can apply submissions';
  end if;

  select * into s from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission % not found', p_submission_id;
  end if;
  if s.status <> 'pending' then
    raise exception 'Submission % is already %', s.id, s.status;
  end if;
  p := s.payload;

  if s.kind = 'new' then
    insert into public.businesses (
      name, location, address, postal_code, category, subcategory_id,
      independence, origin, independence_source, origin_source, website,
      osm_id, data_source, created_by
    ) values (
      p ->> 'name',
      ST_SetSRID(ST_MakePoint((p ->> 'lng')::float8, (p ->> 'lat')::float8), 4326)::geography,
      p ->> 'address',
      p ->> 'postal_code',
      (p ->> 'category')::business_category,
      p ->> 'subcategory_id',
      coalesce((p ->> 'independence')::independence_level, 'unverified'),
      coalesce((p ->> 'origin')::origin_level, 'unverified'),
      p ->> 'independence_source',
      p ->> 'origin_source',
      p ->> 'website',
      p ->> 'osm_id',
      coalesce(p ->> 'data_source', 'community'),
      s.submitted_by
    )
    returning id into v_bid;

    insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
    values (v_bid, '*', null, 'created', s.source, v_actor, s.id);

  else  -- kind = 'edit'
    v_bid := s.business_id;
    select * into b from public.businesses where id = v_bid for update;
    if not found then
      raise exception 'Business % not found', v_bid;
    end if;

    -- Apply only the fields present in the payload; keep the rest untouched.
    update public.businesses set
      name                = case when p ? 'name'                then p ->> 'name' else name end,
      address             = case when p ? 'address'             then p ->> 'address' else address end,
      postal_code         = case when p ? 'postal_code'         then p ->> 'postal_code' else postal_code end,
      category            = case when p ? 'category'            then (p ->> 'category')::business_category else category end,
      subcategory_id      = case when p ? 'subcategory_id'      then p ->> 'subcategory_id' else subcategory_id end,
      independence        = case when p ? 'independence'        then (p ->> 'independence')::independence_level else independence end,
      origin              = case when p ? 'origin'              then (p ->> 'origin')::origin_level else origin end,
      independence_source = case when p ? 'independence_source' then p ->> 'independence_source' else independence_source end,
      origin_source       = case when p ? 'origin_source'       then p ->> 'origin_source' else origin_source end,
      website             = case when p ? 'website'             then p ->> 'website' else website end,
      location            = case when (p ? 'lat' and p ? 'lng')
                                  then ST_SetSRID(ST_MakePoint((p ->> 'lng')::float8, (p ->> 'lat')::float8), 4326)::geography
                                  else location end
    where id = v_bid
    returning * into nb;

    -- Log every field that actually changed.
    if nb.name is distinct from b.name then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'name', b.name, nb.name, s.source, v_actor, s.id); end if;
    if nb.address is distinct from b.address then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'address', b.address, nb.address, s.source, v_actor, s.id); end if;
    if nb.postal_code is distinct from b.postal_code then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'postal_code', b.postal_code, nb.postal_code, s.source, v_actor, s.id); end if;
    if nb.category is distinct from b.category then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'category', b.category::text, nb.category::text, s.source, v_actor, s.id); end if;
    if nb.subcategory_id is distinct from b.subcategory_id then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'subcategory_id', b.subcategory_id, nb.subcategory_id, s.source, v_actor, s.id); end if;
    if nb.independence is distinct from b.independence then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'independence', b.independence::text, nb.independence::text, s.source, v_actor, s.id); end if;
    if nb.origin is distinct from b.origin then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'origin', b.origin::text, nb.origin::text, s.source, v_actor, s.id); end if;
    if nb.independence_source is distinct from b.independence_source then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'independence_source', b.independence_source, nb.independence_source, s.source, v_actor, s.id); end if;
    if nb.origin_source is distinct from b.origin_source then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'origin_source', b.origin_source, nb.origin_source, s.source, v_actor, s.id); end if;
    if nb.website is distinct from b.website then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'website', b.website, nb.website, s.source, v_actor, s.id); end if;
    if not ST_Equals(nb.location::geometry, b.location::geometry) then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'location', ST_AsText(b.location::geometry), ST_AsText(nb.location::geometry), s.source, v_actor, s.id); end if;
  end if;

  update public.submissions
    set status = 'approved', reviewed_by = v_actor, reviewed_at = now()
    where id = s.id;

  update public.profiles
    set contributions_count = contributions_count + 1
    where id = s.submitted_by;

  return v_bid;
end;
$$;

-- ---------------------------------------------------------------------------
-- reject_submission — mark a pending submission rejected with a reason.
-- ---------------------------------------------------------------------------
create or replace function public.reject_submission(p_submission_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.submissions;
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can reject submissions';
  end if;

  select * into s from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission % not found', p_submission_id;
  end if;
  if s.status <> 'pending' then
    raise exception 'Submission % is already %', s.id, s.status;
  end if;

  update public.submissions
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
    where id = s.id;
end;
$$;
