-- Arrowquip TRAVEL — time-lock dry-run (READ ONLY)
-- Project: itgintixzfcvoiuwszdx
-- Run in Supabase SQL Editor. Do NOT run any UPDATE until Mark approves the dry-run.

-- 1) Verify backup schema exists and row counts
select 'backup_state' as src, count(*)::int as n from pb_backup_20261116.prebooking_state
union all
select 'live_state', count(*)::int from public.prebooking_state
union all
select 'backup_history', count(*)::int from pb_backup_20261116.prebooking_history
union all
select 'live_history', count(*)::int from public.prebooking_history;

-- 2) Current live plan version + lock count
select
  s.version as live_version,
  s.updated_at as live_updated_at,
  coalesce(jsonb_object_length(s.data->'tle'->'lock'), 0) as live_lock_count
from public.prebooking_state s
where s.id = 'plan';

-- 3) v2204 locks from BACKUP history (preferred source)
with v2204 as (
  select data->'tle'->'lock' as lock
  from pb_backup_20261116.prebooking_history
  where row_id = 'plan' and new_version = 2204
  order by saved_at desc nulls last
  limit 1
),
live as (
  select data->'tle'->'lock' as lock
  from public.prebooking_state
  where id = 'plan'
)
select
  coalesce(jsonb_object_length(v.lock), 0) as v2204_lock_count,
  coalesce(jsonb_object_length(l.lock), 0) as live_lock_count,
  (
    select count(*) from jsonb_object_keys(coalesce(v.lock, '{}'::jsonb)) k(key)
    where not (coalesce(l.lock, '{}'::jsonb) ? k.key)
  ) as missing_to_add,
  (
    select count(*) from jsonb_object_keys(coalesce(v.lock, '{}'::jsonb)) k(key)
    where coalesce(l.lock, '{}'::jsonb) ? k.key
  ) as already_present,
  (
    select count(*) from jsonb_object_keys(coalesce(l.lock, '{}'::jsonb)) k(key)
    where not (coalesce(v.lock, '{}'::jsonb) ? k.key)
  ) as live_only_newer
from v2204 v, live l;

-- 4) List ONLY the keys that would be ADDED (current wins on clashes — clashes are skipped)
with v2204 as (
  select data->'tle'->'lock' as lock
  from pb_backup_20261116.prebooking_history
  where row_id = 'plan' and new_version = 2204
  order by saved_at desc nulls last
  limit 1
),
live as (
  select data->'tle'->'lock' as lock
  from public.prebooking_state
  where id = 'plan'
)
select k.key as would_add_lock_key
from v2204 v
cross join lateral jsonb_object_keys(coalesce(v.lock, '{}'::jsonb)) as k(key)
cross join live l
where not (coalesce(l.lock, '{}'::jsonb) ? k.key)
order by 1;

-- SAFETY: no UPDATE in this file.
-- After Mark approves, restore ONLY via app save path or an approved write script
-- that merges locks without touching a/appt/time/logi.