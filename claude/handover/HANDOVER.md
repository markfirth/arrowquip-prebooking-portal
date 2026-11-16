# Arrowquip TRAVEL — Session handover (16 Nov 2026, ~17:30 UTC)

See full content recovered into this branch. Authoritative deploy sequence:

1. Confirm write access — DONE (this Cursor session has push rights).
2. Database backup — DONE (`pb_backup_20261116`). Fresh backup only if lots of edits since.
3. Deploy time-lock fix ONLY (commit with index sha `0b2c7498…`) — WAITING Mark approval. Do not push to main until approved.
4. Restore 30 missing locks from v2204 ∪ current (current wins on clashes).
5. Multi-browser/device sync test.
6. Deploy scheduling + places (index sha `9aca416f…`) after testing.
7. Four-day trip demo → expenses, PLAUD, ROI.

## Recovered branch
- Branch: `cursor/deploy-ready-5ecd` (equivalent to Claude's `deploy-ready`)
- HEAD~1 index sha256: `0b2c7498ad4f536f2bf2b69ee992ae7efd9c8e7a3a960434afeb18915cba45a0` (tle fix)
- HEAD index sha256: `9aca416fa1287c650750aad90017e0d80becc8ee546b181bd026c76f694e9893` (scheduling+places)
- GitHub main / production: `dd1b173` / `6587516efe200f26646812a8e7239962ce07c96ba61a71d29013d9018f99b9a9`

## Time-lock restore (needs Mark go-ahead)
1. Deploy tle-fix alone; confirm live sha = `0b2c7498…`
2. `select data->'tle'->'lock' from pb_backup_20261116.prebooking_history where row_id='plan' and new_version=2204;`
3. Merge: restored = v2204.lock ∪ current.lock (CURRENT wins clashes). Only add lock keys; never change a/appt/time/logi/confirmations.
4. Write via app save path (or pb_save_state with current version). Pause editing briefly.
5. Verify lock count + appointments/confirmed unchanged; second-browser reload persistence.

## Do not
- Rebuild / redesign / add pages/tabs/dashboards
- Deploy or modify production without Mark approval
- Touch non-`prebooking_*` / `pb_*` Supabase objects
