-- StallOrigins — 06: read view for the client
-- PostgREST/supabase-js return a raw PostGIS `geography` column as binary (EWKB
-- hex), which is awkward in the browser. This view flattens `location` into
-- plain lat/lng floats and joins the human-readable subcategory label, so the
-- client can `select *` and get exactly what the map needs.
--
-- `security_invoker = true` (PG15+) makes the view honour the querying user's
-- RLS on the underlying `businesses` table — so anon still only sees published
-- rows and moderators see all, exactly as the base-table policies dictate.
set search_path = public, extensions;

create or replace view public.businesses_public
with (security_invoker = true) as
select
  b.id,
  b.name,
  ST_Y(b.location::geometry) as lat,
  ST_X(b.location::geometry) as lng,
  b.address,
  b.postal_code,
  b.category,
  b.subcategory_id,
  sc.label as subcategory_label,
  b.independence,
  b.origin,
  b.independence_source,
  b.origin_source,
  b.website,
  b.data_source,
  b.status,
  b.updated_at
from public.businesses b
left join public.subcategories sc on sc.id = b.subcategory_id;

grant select on public.businesses_public to anon, authenticated;
