-- StallOrigins — DEV seed data (loaded by `supabase db reset`).
-- Illustrative Tiong Bahru points to exercise the app. NOT verified data.
-- Real data is seeded via scripts from data.gov.sg + OSM + manual curation.
set search_path = public, extensions;

insert into public.businesses
  (name, location, category, subcategory_id, independence, origin, independence_source, origin_source, data_source)
values
  ('Tiong Bahru Market (hawker centre)',
   ST_SetSRID(ST_MakePoint(103.8317, 1.2848), 4326)::geography,
   'fnb', 'hawker_centre', 'independent', 'local',
   'Seed data (illustrative)', 'Seed data (illustrative)', 'manual'),
  ('Traditional provision shop',
   ST_SetSRID(ST_MakePoint(103.8329, 1.2861), 4326)::geography,
   'retail', 'provision_shop', 'independent', 'local',
   'Seed data (illustrative)', 'Seed data (illustrative)', 'manual'),
  ('Indie specialty cafe',
   ST_SetSRID(ST_MakePoint(103.8341, 1.2857), 4326)::geography,
   'fnb', 'cafe', 'unverified', 'unverified',
   null, null, 'manual'),
  ('International coffee chain outlet',
   ST_SetSRID(ST_MakePoint(103.8302, 1.2839), 4326)::geography,
   'fnb', 'cafe', 'franchise', 'foreign',
   'Seed data (illustrative)', 'Seed data (illustrative)', 'manual'),
  ('Neighbourhood barber',
   ST_SetSRID(ST_MakePoint(103.8296, 1.2852), 4326)::geography,
   'services', 'barber', 'independent', 'local',
   'Seed data (illustrative)', 'Seed data (illustrative)', 'manual'),
  ('Old-school bakery',
   ST_SetSRID(ST_MakePoint(103.8312, 1.2866), 4326)::geography,
   'fnb', 'bakery', 'chain_small', 'local',
   'Seed data (illustrative)', 'Seed data (illustrative)', 'manual');
