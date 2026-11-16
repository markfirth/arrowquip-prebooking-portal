# Time-lock restoration — safeguards (awaiting Mark approval)

**Status:** Dry-run preparation only. **No production write** until Mark approves the dry-run comparison.

## Goals

- Verify the `pb_backup_20261116` backup independently.
- Compare **missing**, **existing**, and **conflicting** locks.
- Preserve all newer live information.
- Do **not** overwrite appointment times (`a` / `TIME`), bookings (`APPT`), or logistics.
- Restore only missing `TLE.lock` keys from history version **2204**.

## How to connect securely (choose one)

### Option A — Supabase SQL Editor (preferred, no agent secrets)

1. Open [Supabase](https://supabase.com/dashboard) → project `itgintixzfcvoiuwszdx`.
2. SQL Editor → New query.
3. Paste and run **only** `claude/handover/lock-dry-run.sql` (read-only; no `UPDATE`).
4. Paste the result counts / `would_add_lock_key` list back here for review.

### Option B — Agent service-role (read-only dry-run)

Add these Cloud Agent secrets (never paste values into chat):

| Secret | Optional | Purpose |
|--------|----------|---------|
| `SUPABASE_URL` | yes (defaults to project URL) | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **required for agent dry-run** | Server-side read of backup schema |

After secrets are available, the agent re-runs the dry-run and posts the comparison. Still **no write** until you approve.

### Option C — Browser console on live app

While signed in on pre-bookings.com, paste `claude/handover/lock-dry-run-console.js`.  
If v2204 is no longer in the rolling history window, use Option A.

## Merge rules (when write is later approved)

1. For each key in v2204 locks: if live already has the key → **keep live** (conflict / already present).
2. If live lacks the key → **add** from backup.
3. Never touch `appt`, appointment times, dealer rows, or logistics in the same write.
4. Prefer saving via the app plan-save path so history increments normally.

## Files

- `lock-dry-run.sql` — backup verification + counts + would-add keys  
- `lock-dry-run-console.js` — live history dry-run  
- `restore-locks-console.js` — write script (**do not run** until approved)
