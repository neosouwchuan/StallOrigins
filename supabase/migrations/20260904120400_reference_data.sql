-- StallOrigins — 05: reference data (not sample/dev data)
-- Feature-flag defaults and the initial subcategory lookup. Safe to re-run.

-- Feature flags (SPEC §6.1). Anonymous flagging on by default.
insert into public.app_settings (key, enabled, description) values
  ('allow_anonymous_flagging', true, 'Allow logged-out users to report an error on a business')
on conflict (key) do nothing;

-- Subcategory lookup. Extend as coverage grows; keep slugs stable.
insert into public.subcategories (id, category, label) values
  -- Food & drink
  ('hawker_stall',   'fnb',      'Hawker stall'),
  ('hawker_centre',  'fnb',      'Hawker centre'),
  ('kopitiam',       'fnb',      'Coffee shop / kopitiam'),
  ('cafe',           'fnb',      'Cafe'),
  ('restaurant',     'fnb',      'Restaurant'),
  ('bakery',         'fnb',      'Bakery'),
  ('bar',            'fnb',      'Bar'),
  -- Retail
  ('provision_shop', 'retail',   'Provision shop'),
  ('minimart',       'retail',   'Minimart'),
  ('grocer',         'retail',   'Grocer / wet-market stall'),
  ('bookshop',       'retail',   'Bookshop'),
  ('clothing',       'retail',   'Clothing / apparel'),
  ('hardware',       'retail',   'Hardware store'),
  ('pharmacy',       'retail',   'Pharmacy / medical hall'),
  -- Services
  ('barber',         'services', 'Barber / hair salon'),
  ('tailor',         'services', 'Tailor / alterations'),
  ('laundry',        'services', 'Laundry'),
  ('repair',         'services', 'Repair / cobbler / locksmith'),
  ('optician',       'services', 'Optician'),
  ('clinic',         'services', 'Clinic')
on conflict (id) do nothing;
