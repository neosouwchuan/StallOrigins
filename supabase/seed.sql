-- StallOrigins — DEV seed data (loaded by `supabase db reset`).
-- Illustrative points inside Bukit Panjang Plaza + Hillion Mall (the pilot
-- area). NOT verified data. Real data is seeded via scripts from OSM (Overpass,
-- confined to the pilot bounds) + manual curation.
set search_path = public, extensions;

insert into public.businesses
  (name, location, address, category, subcategory_id, independence, origin, independence_source, origin_source, data_source)
values
  ('Kopitiam food court stall',
   ST_SetSRID(ST_MakePoint(103.7626, 1.3787), 4326)::geography,
   'Bukit Panjang Plaza, 1 Jelebu Rd', 'fnb', 'hawker_stall', 'independent', 'local',
   'Seed data (illustrative)', 'Seed data (illustrative)', 'manual'),
  ('Neighbourhood minimart',
   ST_SetSRID(ST_MakePoint(103.7629, 1.3789), 4326)::geography,
   'Bukit Panjang Plaza', 'retail', 'minimart', 'chain_small', 'local',
   'Seed data (illustrative)', 'Seed data (illustrative)', 'manual'),
  ('International fast-food outlet',
   ST_SetSRID(ST_MakePoint(103.7640, 1.3783), 4326)::geography,
   'Hillion Mall, 17 Petir Rd', 'fnb', 'restaurant', 'franchise', 'foreign',
   'Seed data (illustrative)', 'Seed data (illustrative)', 'manual'),
  ('Indie bubble tea stall',
   ST_SetSRID(ST_MakePoint(103.7638, 1.3780), 4326)::geography,
   'Hillion Mall', 'fnb', 'cafe', 'unverified', 'unverified',
   null, null, 'manual'),
  ('Neighbourhood barber',
   ST_SetSRID(ST_MakePoint(103.7624, 1.3785), 4326)::geography,
   'Bukit Panjang Plaza', 'services', 'barber', 'independent', 'local',
   'Seed data (illustrative)', 'Seed data (illustrative)', 'manual'),
  ('Local bakery chain',
   ST_SetSRID(ST_MakePoint(103.7642, 1.3781), 4326)::geography,
   'Hillion Mall', 'fnb', 'bakery', 'chain', 'local',
   'Seed data (illustrative)', 'Seed data (illustrative)', 'manual');
