-- StallOrigins — DEV seed data (loaded by `supabase db reset`).
-- New brand model: classification lives on `brands`; `businesses` are outlets
-- that reference a brand. Illustrative points inside Bukit Panjang Plaza +
-- Hillion Mall. NOT verified data.
set search_path = public, extensions;

-- Brands (identity + classification). origin_country is an ISO code (null = unverified).
insert into public.brands (name, category, subcategory_id, independence, origin_country, independence_source, origin_source)
values
  ('Kopitiam food court stall',   'fnb',      'hawker_stall', 'independent', 'SG', 'Seed data (illustrative)', 'Seed data (illustrative)'),
  ('Neighbourhood minimart',      'retail',   'minimart',     'chain',       'SG', 'Seed data (illustrative)', 'Seed data (illustrative)'),
  ('International fast-food outlet','fnb',     'restaurant',   'franchise',   'US', 'Seed data (illustrative)', 'Seed data (illustrative)'),
  ('Indie bubble tea stall',      'fnb',      'cafe',         'unverified',  null, null, null),
  ('Neighbourhood barber',        'services', 'barber',       'independent', 'SG', 'Seed data (illustrative)', 'Seed data (illustrative)'),
  ('Local bakery chain',          'fnb',      'bakery',       'chain',       'SG', 'Seed data (illustrative)', 'Seed data (illustrative)')
on conflict (name) do nothing;

-- Outlets (reference the brand by name; outlet `name` left null → defaults to brand name).
insert into public.businesses (brand_id, location, address, building, data_source)
values
  ((select id from public.brands where name = 'Kopitiam food court stall'),
   ST_SetSRID(ST_MakePoint(103.7626, 1.3787), 4326)::geography, 'Bukit Panjang Plaza, 1 Jelebu Rd', 'Bukit Panjang Plaza', 'manual'),
  ((select id from public.brands where name = 'Neighbourhood minimart'),
   ST_SetSRID(ST_MakePoint(103.7629, 1.3789), 4326)::geography, 'Bukit Panjang Plaza', 'Bukit Panjang Plaza', 'manual'),
  ((select id from public.brands where name = 'International fast-food outlet'),
   ST_SetSRID(ST_MakePoint(103.7640, 1.3783), 4326)::geography, 'Hillion Mall, 17 Petir Rd', 'Hillion Mall', 'manual'),
  ((select id from public.brands where name = 'Indie bubble tea stall'),
   ST_SetSRID(ST_MakePoint(103.7638, 1.3780), 4326)::geography, 'Hillion Mall', 'Hillion Mall', 'manual'),
  ((select id from public.brands where name = 'Neighbourhood barber'),
   ST_SetSRID(ST_MakePoint(103.7624, 1.3785), 4326)::geography, 'Bukit Panjang Plaza', 'Bukit Panjang Plaza', 'manual'),
  ((select id from public.brands where name = 'Local bakery chain'),
   ST_SetSRID(ST_MakePoint(103.7642, 1.3781), 4326)::geography, 'Hillion Mall', 'Hillion Mall', 'manual');
