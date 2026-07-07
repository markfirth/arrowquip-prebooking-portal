-- Pre-Booking Portal — Dealer Directory (central dealer/account sync table).
--
-- Mirrors the MFOS Dealer Directory pattern, adapted for this ORG-SHARED portal
-- (RLS keys on app_metadata.organization = 'arrowquip', not per-user).
--
-- Salesforce is the source of truth for dealer INFORMATION and is READ-ONLY:
-- the sync only SELECTs Accounts across every area/territory (no OwnerId filter)
-- and never writes back. Planner-specific + admin settings live LOCALLY here and
-- are never clobbered by a re-sync. Deduplicated by salesforce_account_id, so a
-- dealer can never have duplicate rows. This migration is idempotent.

create extension if not exists pgcrypto with schema extensions;

-- Shared updated_at trigger fn (idempotent) --------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.dealer_directory (
  id uuid primary key default extensions.gen_random_uuid(),

  -- Salesforce identity (dedupe key — no duplicate dealer records) ----------
  salesforce_account_id text not null unique,

  -- Salesforce-sourced information (overwritten on every read-only sync) -----
  dealer_name text not null default '',
  team text,                          -- raw Salesforce "Team" value
  account_owner text,                 -- Account Owner (Owner.Name)
  territory_manager text,             -- Territory Manager
  dealer_success_specialist text,     -- Dealer Success Specialist
  billing_city text,
  billing_state text,
  billing_country text,
  status text,                        -- Salesforce account status

  -- Area / territory --------------------------------------------------------
  -- `area` is derived from Salesforce (Team/Territory/country) on each sync.
  -- `area_override` is set by an admin when Salesforce is missing/wrong and it
  -- ALWAYS wins. Effective area = coalesce(area_override, area).
  -- One of: East | South | Central | West | Exports | Unassigned
  area text not null default 'Unassigned',
  area_override text,

  -- Local-only admin + planner settings (NEVER pushed to Salesforce and NEVER
  -- overwritten by a Salesforce re-sync) ------------------------------------
  visible_in_portal boolean not null default true,
  show_in_area_tabs boolean not null default true,
  notes text,
  -- Free-form planner / manual scheduling data (weeks, days, confirmations…).
  -- Preserved verbatim across syncs.
  planner_data jsonb not null default '{}'::jsonb,

  -- Salesforce source presence (never deleted locally) ----------------------
  sf_present boolean not null default true,
  source_missing_at timestamptz,

  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Effective area (override wins over the Salesforce-derived area) -----------
create or replace view public.dealer_directory_effective
with (security_invoker = true) as
select
  d.*,
  coalesce(nullif(trim(d.area_override), ''), d.area) as effective_area
from public.dealer_directory d;

-- Indexes ------------------------------------------------------------------
create index if not exists dealer_directory_area_idx on public.dealer_directory (area);
create index if not exists dealer_directory_visible_idx on public.dealer_directory (visible_in_portal);
create index if not exists dealer_directory_sf_present_idx on public.dealer_directory (sf_present);

-- updated_at trigger -------------------------------------------------------
drop trigger if exists dealer_directory_set_updated_at on public.dealer_directory;
create trigger dealer_directory_set_updated_at
  before update on public.dealer_directory
  for each row
  execute function public.set_updated_at();

-- Row Level Security -------------------------------------------------------
-- Reads: any authenticated Arrowquip org member. Writes (admin edits to local
-- settings / area override): arrowquip_admin. The server sync uses the service
-- role and bypasses RLS.
alter table public.dealer_directory enable row level security;

drop policy if exists dealer_directory_org_read on public.dealer_directory;
create policy dealer_directory_org_read
on public.dealer_directory
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'organization') = 'arrowquip');

drop policy if exists dealer_directory_admin_manage on public.dealer_directory;
create policy dealer_directory_admin_manage
on public.dealer_directory
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'arrowquip_admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'arrowquip_admin');
