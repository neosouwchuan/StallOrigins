-- StallOrigins — 04: Row-Level Security (SPEC §4)
-- Reads are open (published rows); writes go through the moderation queue.
-- The only path that mutates live `businesses` is apply_submission()
-- (SECURITY DEFINER), which bypasses these policies.

-- Table privileges. RLS narrows these further; without the GRANT the operation
-- is denied regardless of policy.
grant usage on schema public to anon, authenticated;

grant select on public.businesses, public.subcategories, public.edit_history,
                public.app_settings to anon, authenticated;
grant select on public.business_stories to anon, authenticated;
grant select on public.profiles, public.submissions, public.owner_claims, public.flags
  to authenticated;
grant insert on public.submissions, public.owner_claims to authenticated;
grant insert on public.flags to anon, authenticated;      -- anon gated by policy
grant update on public.submissions, public.flags, public.owner_claims,
                public.businesses, public.business_stories, public.profiles
  to authenticated;
grant insert, delete on public.business_stories to authenticated;
grant delete on public.businesses to authenticated;       -- gated to admins by policy

grant execute on function public.apply_submission(uuid) to authenticated;
grant execute on function public.reject_submission(uuid, text) to authenticated;
grant execute on function public.feature_enabled(text) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
-- anon needs is_moderator() too: it appears in anon-facing SELECT policies below.
grant execute on function public.is_moderator() to anon, authenticated;

-- Enable RLS on everything.
alter table public.profiles          enable row level security;
alter table public.app_settings      enable row level security;
alter table public.subcategories     enable row level security;
alter table public.businesses        enable row level security;
alter table public.submissions       enable row level security;
alter table public.flags             enable row level security;
alter table public.edit_history      enable row level security;
alter table public.owner_claims      enable row level security;
alter table public.business_stories  enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated using (true);
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- (role changes are blocked for non-admins by the prevent_role_change trigger)

-- ---------------------------------------------------------------------------
-- app_settings — feature flags are world-readable; only admins change them
-- ---------------------------------------------------------------------------
create policy app_settings_select on public.app_settings
  for select to anon, authenticated using (true);
create policy app_settings_write on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- subcategories — public read; admin write
-- ---------------------------------------------------------------------------
create policy subcategories_select on public.subcategories
  for select to anon, authenticated using (true);
create policy subcategories_write on public.subcategories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- businesses — anon/auth read published; moderators see & edit all
-- ---------------------------------------------------------------------------
create policy businesses_select on public.businesses
  for select to anon, authenticated
  using (status = 'published' or public.is_moderator());
create policy businesses_mod_insert on public.businesses
  for insert to authenticated with check (public.is_moderator());
create policy businesses_mod_update on public.businesses
  for update to authenticated using (public.is_moderator()) with check (public.is_moderator());
create policy businesses_admin_delete on public.businesses
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- submissions — contributors insert their own; see own; moderators review
-- ---------------------------------------------------------------------------
create policy submissions_insert on public.submissions
  for insert to authenticated with check (submitted_by = auth.uid());
create policy submissions_select on public.submissions
  for select to authenticated using (submitted_by = auth.uid() or public.is_moderator());
create policy submissions_mod_update on public.submissions
  for update to authenticated using (public.is_moderator()) with check (public.is_moderator());

-- ---------------------------------------------------------------------------
-- flags — anonymous reports allowed while the feature flag is on (SPEC §6.1)
-- ---------------------------------------------------------------------------
create policy flags_insert_anon on public.flags
  for insert to anon
  with check (reported_by is null and public.feature_enabled('allow_anonymous_flagging'));
create policy flags_insert_auth on public.flags
  for insert to authenticated
  with check (
    (reported_by = auth.uid())
    or (reported_by is null and public.feature_enabled('allow_anonymous_flagging'))
  );
create policy flags_select on public.flags
  for select to authenticated using (reported_by = auth.uid() or public.is_moderator());
create policy flags_mod_update on public.flags
  for update to authenticated using (public.is_moderator()) with check (public.is_moderator());

-- ---------------------------------------------------------------------------
-- edit_history — the public transparency log (read-only to everyone)
-- Writes happen only inside apply_submission (SECURITY DEFINER); no write policy.
-- ---------------------------------------------------------------------------
create policy edit_history_select on public.edit_history
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- owner_claims — claimant inserts/sees own; moderators review
-- ---------------------------------------------------------------------------
create policy owner_claims_insert on public.owner_claims
  for insert to authenticated with check (claimant_id = auth.uid());
create policy owner_claims_select on public.owner_claims
  for select to authenticated using (claimant_id = auth.uid() or public.is_moderator());
create policy owner_claims_mod_update on public.owner_claims
  for update to authenticated using (public.is_moderator()) with check (public.is_moderator());

-- ---------------------------------------------------------------------------
-- business_stories — public reads published; owner manages own (needs a
-- verified claim to create); moderators/admins oversee
-- ---------------------------------------------------------------------------
create policy stories_select on public.business_stories
  for select to anon, authenticated
  using (published or owner_id = auth.uid() or public.is_moderator());
create policy stories_insert on public.business_stories
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.owner_claims c
      where c.business_id = business_stories.business_id
        and c.claimant_id = auth.uid()
        and c.status = 'verified'
    )
  );
create policy stories_update on public.business_stories
  for update to authenticated
  using (owner_id = auth.uid() or public.is_moderator())
  with check (owner_id = auth.uid() or public.is_moderator());
create policy stories_delete on public.business_stories
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());
