-- Arrowquip Dealer Coverage & Competitive Gap Map
-- Supabase/PostgreSQL schema for internal strategic planning.
-- Run in a Supabase project after reviewing organization-specific roles.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.dealer_type as enum (
  'Premier Dealer',
  'Growth Dealer',
  'Service Dealer',
  'Inventory Partner'
);

create type public.competitor_brand as enum (
  'Priefert',
  'WW',
  'Powder River',
  'Pearson',
  'Sioux Steel',
  'Tarter',
  'Hi-Hog',
  'Real Tuff',
  'Titan West'
);

create type public.market_classification as enum (
  'Protected Market',
  'Build Market',
  'Open Market',
  'Low Priority'
);

create type public.trade_show_type as enum (
  'Farm Show',
  'State Fair',
  'Cattlemen Meeting',
  'Feedlot Conference',
  'Open House',
  'Demo Day',
  'Auction Event'
);

create table public.arrowquip_dealers (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  type public.dealer_type not null,
  city text not null,
  state text not null,
  county text not null,
  lat double precision not null,
  lng double precision not null,
  location extensions.geography(point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  revenue numeric(14, 2) not null default 0,
  registrations integer not null default 0,
  inventory_value numeric(14, 2) not null default 0,
  dealer_score integer not null check (dealer_score between 0 and 100),
  forecast_accuracy integer not null check (forecast_accuracy between 0 and 100),
  territory_manager text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.competitor_dealers (
  id uuid primary key default extensions.gen_random_uuid(),
  brand public.competitor_brand not null,
  name text not null,
  city text not null,
  state text not null,
  website text not null,
  lat double precision not null,
  lng double precision not null,
  location extensions.geography(point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  distance_to_nearest_arrowquip_dealer numeric(8, 2),
  opportunity_score integer not null check (opportunity_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.markets (
  id uuid primary key default extensions.gen_random_uuid(),
  market text not null,
  state text not null,
  county text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  center extensions.geography(point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(center_lng, center_lat), 4326)::extensions.geography) stored,
  cattle_density integer not null check (cattle_density between 0 and 100),
  competitor_dealers integer not null default 0,
  arrowquip_dealers integer not null default 0,
  distance_to_nearest_arrowquip_dealer integer not null check (distance_to_nearest_arrowquip_dealer between 0 and 100),
  lead_activity integer not null check (lead_activity between 0 and 100),
  trade_show_activity integer not null check (trade_show_activity between 0 and 100),
  strategic_priority integer not null check (strategic_priority between 0 and 100),
  beef_cows integer not null default 0,
  feedlots integer not null default 0,
  ranch_density integer not null check (ranch_density between 0 and 100),
  auction_marts integer not null default 0,
  registrations integer not null default 0,
  revenue numeric(14, 2) not null default 0,
  opportunity_score integer generated always as (
    round(
      cattle_density * 0.30
      + least(competitor_dealers * 18, 100) * 0.20
      + distance_to_nearest_arrowquip_dealer * 0.20
      + lead_activity * 0.15
      + trade_show_activity * 0.10
      + strategic_priority * 0.05
    )::integer
  ) stored,
  classification public.market_classification generated always as (
    case
      when arrowquip_dealers > 1 and (
        cattle_density * 0.30
        + least(competitor_dealers * 18, 100) * 0.20
        + distance_to_nearest_arrowquip_dealer * 0.20
        + lead_activity * 0.15
        + trade_show_activity * 0.10
        + strategic_priority * 0.05
      ) >= 62 then 'Protected Market'::public.market_classification
      when (
        cattle_density * 0.30
        + least(competitor_dealers * 18, 100) * 0.20
        + distance_to_nearest_arrowquip_dealer * 0.20
        + lead_activity * 0.15
        + trade_show_activity * 0.10
        + strategic_priority * 0.05
      ) >= 74 then 'Open Market'::public.market_classification
      when (
        cattle_density * 0.30
        + least(competitor_dealers * 18, 100) * 0.20
        + distance_to_nearest_arrowquip_dealer * 0.20
        + lead_activity * 0.15
        + trade_show_activity * 0.10
        + strategic_priority * 0.05
      ) >= 52 then 'Build Market'::public.market_classification
      else 'Low Priority'::public.market_classification
    end
  ) stored,
  recommended_action text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trade_show_events (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  type public.trade_show_type not null,
  city text not null,
  state text not null,
  date date not null,
  attendance integer not null default 0,
  dealer_assigned text not null default 'Unassigned',
  leads_generated integer not null default 0,
  registrations_generated integer not null default 0,
  revenue_generated numeric(14, 2) not null default 0,
  roi numeric(8, 2) not null default 0,
  lat double precision not null,
  lng double precision not null,
  location extensions.geography(point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index arrowquip_dealers_location_idx on public.arrowquip_dealers using gist (location);
create index competitor_dealers_location_idx on public.competitor_dealers using gist (location);
create index markets_center_idx on public.markets using gist (center);
create index trade_show_events_location_idx on public.trade_show_events using gist (location);
create index markets_opportunity_score_idx on public.markets (opportunity_score desc);
create index competitor_dealers_brand_idx on public.competitor_dealers (brand);

create view public.market_opportunity_rankings
with (security_invoker = true) as
select
  market,
  state,
  county,
  cattle_density,
  competitor_dealers,
  arrowquip_dealers,
  opportunity_score,
  classification,
  recommended_action
from public.markets
order by opportunity_score desc;

alter table public.arrowquip_dealers enable row level security;
alter table public.competitor_dealers enable row level security;
alter table public.markets enable row level security;
alter table public.trade_show_events enable row level security;

create policy "arrowquip authenticated read arrowquip dealers"
on public.arrowquip_dealers
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'organization') = 'arrowquip');

create policy "arrowquip authenticated read competitor dealers"
on public.competitor_dealers
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'organization') = 'arrowquip');

create policy "arrowquip authenticated read markets"
on public.markets
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'organization') = 'arrowquip');

create policy "arrowquip authenticated read trade shows"
on public.trade_show_events
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'organization') = 'arrowquip');

create policy "arrowquip admins manage arrowquip dealers"
on public.arrowquip_dealers
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'arrowquip_admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'arrowquip_admin');

create policy "arrowquip admins manage competitor dealers"
on public.competitor_dealers
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'arrowquip_admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'arrowquip_admin');

create policy "arrowquip admins manage markets"
on public.markets
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'arrowquip_admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'arrowquip_admin');

create policy "arrowquip admins manage trade shows"
on public.trade_show_events
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'arrowquip_admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'arrowquip_admin');
