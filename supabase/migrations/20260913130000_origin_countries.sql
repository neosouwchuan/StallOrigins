-- StallOrigins — 08: ownership origin as COUNTRY (ISO 3166-1). SPEC §3.
-- Origin becomes the place/country of ownership, chosen from an official list
-- (the `countries` table). `origin_country` = 'SG' is the buy-local signal;
-- null = unverified. Existing local/foreign values migrate (local -> SG,
-- foreign -> null since the country is unknown).
set search_path = public, extensions;

-- Official country reference list (ISO 3166-1 alpha-2).
create table if not exists public.countries (
  code text primary key,
  name text not null
);
insert into public.countries (code, name) values
  ('AD', 'Andorra'),
  ('AE', 'United Arab Emirates'),
  ('AF', 'Afghanistan'),
  ('AG', 'Antigua & Barbuda'),
  ('AI', 'Anguilla'),
  ('AL', 'Albania'),
  ('AM', 'Armenia'),
  ('AO', 'Angola'),
  ('AQ', 'Antarctica'),
  ('AR', 'Argentina'),
  ('AS', 'American Samoa'),
  ('AT', 'Austria'),
  ('AU', 'Australia'),
  ('AW', 'Aruba'),
  ('AX', 'Åland Islands'),
  ('AZ', 'Azerbaijan'),
  ('BA', 'Bosnia & Herzegovina'),
  ('BB', 'Barbados'),
  ('BD', 'Bangladesh'),
  ('BE', 'Belgium'),
  ('BF', 'Burkina Faso'),
  ('BG', 'Bulgaria'),
  ('BH', 'Bahrain'),
  ('BI', 'Burundi'),
  ('BJ', 'Benin'),
  ('BL', 'St. Barthélemy'),
  ('BM', 'Bermuda'),
  ('BN', 'Brunei'),
  ('BO', 'Bolivia'),
  ('BQ', 'Caribbean Netherlands'),
  ('BR', 'Brazil'),
  ('BS', 'Bahamas'),
  ('BT', 'Bhutan'),
  ('BV', 'Bouvet Island'),
  ('BW', 'Botswana'),
  ('BY', 'Belarus'),
  ('BZ', 'Belize'),
  ('CA', 'Canada'),
  ('CC', 'Cocos (Keeling) Islands'),
  ('CD', 'Congo - Kinshasa'),
  ('CF', 'Central African Republic'),
  ('CG', 'Congo - Brazzaville'),
  ('CH', 'Switzerland'),
  ('CI', 'Côte d’Ivoire'),
  ('CK', 'Cook Islands'),
  ('CL', 'Chile'),
  ('CM', 'Cameroon'),
  ('CN', 'China'),
  ('CO', 'Colombia'),
  ('CR', 'Costa Rica'),
  ('CU', 'Cuba'),
  ('CV', 'Cape Verde'),
  ('CW', 'Curaçao'),
  ('CX', 'Christmas Island'),
  ('CY', 'Cyprus'),
  ('CZ', 'Czechia'),
  ('DE', 'Germany'),
  ('DJ', 'Djibouti'),
  ('DK', 'Denmark'),
  ('DM', 'Dominica'),
  ('DO', 'Dominican Republic'),
  ('DZ', 'Algeria'),
  ('EC', 'Ecuador'),
  ('EE', 'Estonia'),
  ('EG', 'Egypt'),
  ('EH', 'Western Sahara'),
  ('ER', 'Eritrea'),
  ('ES', 'Spain'),
  ('ET', 'Ethiopia'),
  ('FI', 'Finland'),
  ('FJ', 'Fiji'),
  ('FK', 'Falkland Islands'),
  ('FM', 'Micronesia'),
  ('FO', 'Faroe Islands'),
  ('FR', 'France'),
  ('GA', 'Gabon'),
  ('GB', 'United Kingdom'),
  ('GD', 'Grenada'),
  ('GE', 'Georgia'),
  ('GF', 'French Guiana'),
  ('GG', 'Guernsey'),
  ('GH', 'Ghana'),
  ('GI', 'Gibraltar'),
  ('GL', 'Greenland'),
  ('GM', 'Gambia'),
  ('GN', 'Guinea'),
  ('GP', 'Guadeloupe'),
  ('GQ', 'Equatorial Guinea'),
  ('GR', 'Greece'),
  ('GS', 'South Georgia & South Sandwich Islands'),
  ('GT', 'Guatemala'),
  ('GU', 'Guam'),
  ('GW', 'Guinea-Bissau'),
  ('GY', 'Guyana'),
  ('HK', 'Hong Kong SAR China'),
  ('HM', 'Heard & McDonald Islands'),
  ('HN', 'Honduras'),
  ('HR', 'Croatia'),
  ('HT', 'Haiti'),
  ('HU', 'Hungary'),
  ('ID', 'Indonesia'),
  ('IE', 'Ireland'),
  ('IL', 'Israel'),
  ('IM', 'Isle of Man'),
  ('IN', 'India'),
  ('IO', 'British Indian Ocean Territory'),
  ('IQ', 'Iraq'),
  ('IR', 'Iran'),
  ('IS', 'Iceland'),
  ('IT', 'Italy'),
  ('JE', 'Jersey'),
  ('JM', 'Jamaica'),
  ('JO', 'Jordan'),
  ('JP', 'Japan'),
  ('KE', 'Kenya'),
  ('KG', 'Kyrgyzstan'),
  ('KH', 'Cambodia'),
  ('KI', 'Kiribati'),
  ('KM', 'Comoros'),
  ('KN', 'St. Kitts & Nevis'),
  ('KP', 'North Korea'),
  ('KR', 'South Korea'),
  ('KW', 'Kuwait'),
  ('KY', 'Cayman Islands'),
  ('KZ', 'Kazakhstan'),
  ('LA', 'Laos'),
  ('LB', 'Lebanon'),
  ('LC', 'St. Lucia'),
  ('LI', 'Liechtenstein'),
  ('LK', 'Sri Lanka'),
  ('LR', 'Liberia'),
  ('LS', 'Lesotho'),
  ('LT', 'Lithuania'),
  ('LU', 'Luxembourg'),
  ('LV', 'Latvia'),
  ('LY', 'Libya'),
  ('MA', 'Morocco'),
  ('MC', 'Monaco'),
  ('MD', 'Moldova'),
  ('ME', 'Montenegro'),
  ('MF', 'St. Martin'),
  ('MG', 'Madagascar'),
  ('MH', 'Marshall Islands'),
  ('MK', 'North Macedonia'),
  ('ML', 'Mali'),
  ('MM', 'Myanmar (Burma)'),
  ('MN', 'Mongolia'),
  ('MO', 'Macao SAR China'),
  ('MP', 'Northern Mariana Islands'),
  ('MQ', 'Martinique'),
  ('MR', 'Mauritania'),
  ('MS', 'Montserrat'),
  ('MT', 'Malta'),
  ('MU', 'Mauritius'),
  ('MV', 'Maldives'),
  ('MW', 'Malawi'),
  ('MX', 'Mexico'),
  ('MY', 'Malaysia'),
  ('MZ', 'Mozambique'),
  ('NA', 'Namibia'),
  ('NC', 'New Caledonia'),
  ('NE', 'Niger'),
  ('NF', 'Norfolk Island'),
  ('NG', 'Nigeria'),
  ('NI', 'Nicaragua'),
  ('NL', 'Netherlands'),
  ('NO', 'Norway'),
  ('NP', 'Nepal'),
  ('NR', 'Nauru'),
  ('NU', 'Niue'),
  ('NZ', 'New Zealand'),
  ('OM', 'Oman'),
  ('PA', 'Panama'),
  ('PE', 'Peru'),
  ('PF', 'French Polynesia'),
  ('PG', 'Papua New Guinea'),
  ('PH', 'Philippines'),
  ('PK', 'Pakistan'),
  ('PL', 'Poland'),
  ('PM', 'St. Pierre & Miquelon'),
  ('PN', 'Pitcairn Islands'),
  ('PR', 'Puerto Rico'),
  ('PS', 'Palestinian Territories'),
  ('PT', 'Portugal'),
  ('PW', 'Palau'),
  ('PY', 'Paraguay'),
  ('QA', 'Qatar'),
  ('RE', 'Réunion'),
  ('RO', 'Romania'),
  ('RS', 'Serbia'),
  ('RU', 'Russia'),
  ('RW', 'Rwanda'),
  ('SA', 'Saudi Arabia'),
  ('SB', 'Solomon Islands'),
  ('SC', 'Seychelles'),
  ('SD', 'Sudan'),
  ('SE', 'Sweden'),
  ('SG', 'Singapore'),
  ('SH', 'St. Helena'),
  ('SI', 'Slovenia'),
  ('SJ', 'Svalbard & Jan Mayen'),
  ('SK', 'Slovakia'),
  ('SL', 'Sierra Leone'),
  ('SM', 'San Marino'),
  ('SN', 'Senegal'),
  ('SO', 'Somalia'),
  ('SR', 'Suriname'),
  ('SS', 'South Sudan'),
  ('ST', 'São Tomé & Príncipe'),
  ('SV', 'El Salvador'),
  ('SX', 'Sint Maarten'),
  ('SY', 'Syria'),
  ('SZ', 'Eswatini'),
  ('TC', 'Turks & Caicos Islands'),
  ('TD', 'Chad'),
  ('TF', 'French Southern Territories'),
  ('TG', 'Togo'),
  ('TH', 'Thailand'),
  ('TJ', 'Tajikistan'),
  ('TK', 'Tokelau'),
  ('TL', 'Timor-Leste'),
  ('TM', 'Turkmenistan'),
  ('TN', 'Tunisia'),
  ('TO', 'Tonga'),
  ('TR', 'Türkiye'),
  ('TT', 'Trinidad & Tobago'),
  ('TV', 'Tuvalu'),
  ('TW', 'Taiwan'),
  ('TZ', 'Tanzania'),
  ('UA', 'Ukraine'),
  ('UG', 'Uganda'),
  ('UM', 'U.S. Outlying Islands'),
  ('US', 'United States'),
  ('UY', 'Uruguay'),
  ('UZ', 'Uzbekistan'),
  ('VA', 'Vatican City'),
  ('VC', 'St. Vincent & Grenadines'),
  ('VE', 'Venezuela'),
  ('VG', 'British Virgin Islands'),
  ('VI', 'U.S. Virgin Islands'),
  ('VN', 'Vietnam'),
  ('VU', 'Vanuatu'),
  ('WF', 'Wallis & Futuna'),
  ('WS', 'Samoa'),
  ('YE', 'Yemen'),
  ('YT', 'Mayotte'),
  ('ZA', 'South Africa'),
  ('ZM', 'Zambia'),
  ('ZW', 'Zimbabwe')
on conflict (code) do nothing;

grant select on public.countries to anon, authenticated;
alter table public.countries enable row level security;
create policy countries_select on public.countries
  for select to anon, authenticated using (true);

-- Drop the view first — it references brands.origin, which we're removing.
drop view if exists public.businesses_public;

-- brands: origin is now a country code (null = unverified).
alter table public.brands add column if not exists origin_country text
  references public.countries (code);

update public.brands set origin_country = case origin::text
  when 'local' then 'SG' when 'singaporean' then 'SG'
  when 'malaysian' then 'MY' when 'hong_kong' then 'HK' when 'taiwanese' then 'TW'
  when 'chinese' then 'CN' when 'american' then 'US'
  when 'japanese' then 'JP' when 'korean' then 'KR'
  else null end;

alter table public.brands drop constraint if exists brand_origin_needs_source;
alter table public.brands drop column if exists origin;
alter table public.brands add constraint brand_origin_needs_source
  check (origin_country is null or origin_source is not null);
create index if not exists brands_origin_country_idx on public.brands (origin_country);

-- Rebuild the read view with the country join.
drop view if exists public.businesses_public;
create or replace view public.businesses_public
with (security_invoker = true) as
select
  b.id,
  coalesce(b.name, br.name)   as name,
  ST_Y(b.location::geometry)  as lat,
  ST_X(b.location::geometry)  as lng,
  b.address,
  b.postal_code,
  b.building,
  b.brand_id,
  br.name                     as brand_name,
  br.category,
  br.subcategory_id,
  sc.label                    as subcategory_label,
  br.independence,
  br.independence_source,
  br.origin_country,
  c.name                      as origin_country_name,
  br.origin_source,
  br.website,
  b.data_source,
  b.status,
  b.updated_at
from public.businesses b
join public.brands br on br.id = b.brand_id
left join public.subcategories sc on sc.id = br.subcategory_id
left join public.countries c on c.code = br.origin_country;
grant select on public.businesses_public to anon, authenticated;

-- apply_submission: origin is a country code (payload key: origin_country).
create or replace function public.apply_submission(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s        public.submissions;
  p        jsonb;
  v_actor  uuid := auth.uid();
  v_bid    uuid;
  v_brand  uuid;
  ob       public.brands;
  nb       public.brands;
  obiz     public.businesses;
  nbiz     public.businesses;
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can apply submissions';
  end if;

  select * into s from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'Submission % not found', p_submission_id; end if;
  if s.status <> 'pending' then raise exception 'Submission % is already %', s.id, s.status; end if;
  p := s.payload;

  if s.kind = 'new' then
    v_brand := (select id from public.brands where name = coalesce(p ->> 'brand_name', p ->> 'name'));
    if v_brand is null then
      insert into public.brands (name, category, subcategory_id, independence,
                                 independence_source, origin_country, origin_source, website, created_by)
      values (
        coalesce(p ->> 'brand_name', p ->> 'name'),
        (p ->> 'category')::business_category,
        p ->> 'subcategory_id',
        coalesce((p ->> 'independence')::independence_level, 'unverified'),
        p ->> 'independence_source',
        p ->> 'origin_country',
        p ->> 'origin_source', p ->> 'website', s.submitted_by
      )
      returning id into v_brand;
    end if;

    insert into public.businesses (brand_id, name, location, address, postal_code, building,
                                   osm_id, data_source, created_by)
    values (
      v_brand, p ->> 'name',
      ST_SetSRID(ST_MakePoint((p ->> 'lng')::float8, (p ->> 'lat')::float8), 4326)::geography,
      p ->> 'address', p ->> 'postal_code', p ->> 'building', p ->> 'osm_id',
      coalesce(p ->> 'data_source', 'community'), s.submitted_by
    )
    returning id into v_bid;

    insert into public.edit_history (business_id, brand_id, field, old_value, new_value, source, changed_by, submission_id)
    values (v_bid, v_brand, '*', null, 'created', s.source, v_actor, s.id);

  elsif s.brand_id is not null then
    v_brand := s.brand_id;
    select * into ob from public.brands where id = v_brand for update;
    if not found then raise exception 'Brand % not found', v_brand; end if;

    update public.brands set
      independence        = case when p ? 'independence'        then (p ->> 'independence')::independence_level else independence end,
      independence_source = case when p ? 'independence_source' then p ->> 'independence_source' else independence_source end,
      origin_country      = case when p ? 'origin_country'      then p ->> 'origin_country' else origin_country end,
      origin_source       = case when p ? 'origin_source'       then p ->> 'origin_source' else origin_source end,
      category            = case when p ? 'category'            then (p ->> 'category')::business_category else category end,
      subcategory_id      = case when p ? 'subcategory_id'      then p ->> 'subcategory_id' else subcategory_id end,
      website             = case when p ? 'website'             then p ->> 'website' else website end,
      name                = case when p ? 'name'                then p ->> 'name' else name end
    where id = v_brand
    returning * into nb;

    if nb.independence is distinct from ob.independence then
      insert into public.edit_history (brand_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_brand, 'independence', ob.independence::text, nb.independence::text, s.source, v_actor, s.id); end if;
    if nb.origin_country is distinct from ob.origin_country then
      insert into public.edit_history (brand_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_brand, 'origin_country', ob.origin_country, nb.origin_country, s.source, v_actor, s.id); end if;
    if nb.name is distinct from ob.name then
      insert into public.edit_history (brand_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_brand, 'name', ob.name, nb.name, s.source, v_actor, s.id); end if;

  else
    v_bid := s.business_id;
    select * into obiz from public.businesses where id = v_bid for update;
    if not found then raise exception 'Business % not found', v_bid; end if;

    update public.businesses set
      name        = case when p ? 'name'        then p ->> 'name' else name end,
      address     = case when p ? 'address'     then p ->> 'address' else address end,
      postal_code = case when p ? 'postal_code' then p ->> 'postal_code' else postal_code end,
      building    = case when p ? 'building'    then p ->> 'building' else building end,
      location    = case when (p ? 'lat' and p ? 'lng')
                         then ST_SetSRID(ST_MakePoint((p ->> 'lng')::float8, (p ->> 'lat')::float8), 4326)::geography
                         else location end
    where id = v_bid
    returning * into nbiz;

    if nbiz.name is distinct from obiz.name then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'name', obiz.name, nbiz.name, s.source, v_actor, s.id); end if;
    if not ST_Equals(nbiz.location::geometry, obiz.location::geometry) then
      insert into public.edit_history (business_id, field, old_value, new_value, source, changed_by, submission_id)
      values (v_bid, 'location', ST_AsText(obiz.location::geometry), ST_AsText(nbiz.location::geometry), s.source, v_actor, s.id); end if;
  end if;

  update public.submissions set status = 'approved', reviewed_by = v_actor, reviewed_at = now() where id = s.id;
  update public.profiles set contributions_count = contributions_count + 1 where id = s.submitted_by;
  return coalesce(v_bid, v_brand);
end;
$$;
