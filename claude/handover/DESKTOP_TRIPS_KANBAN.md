# Desktop Trips Kanban layout

**Preview only — do not merge to production until Mark approves.**

## What changed (layout / navigation only)
- Permanent left sidebar: Year → Quarter → Month → Week (all weeks through end of next year).
- **This Week** always = actual current Sunday–Saturday week (`wkCurrent()` / local timezone).
- Fresh login opens the current week and expands its year/quarter/month.
- Main workspace: one week as a 7-column Kanban (Sun–Sat).
- Right map pane: collapsed / split / full; divider is resizable.
- Week focus + map mode stored in `sessionStorage` / `localStorage` only — **never** written to the shared plan.

## Preserved
- Appointments, bookings, time locks (`TLE.lock`), confirmations, DnD day moves, + Add, driving legs, trip export, cloud save path.

## Cloud synchronization
Existing event-level merge + conflict UI (`EVCONFLICT`) remains the safeguard when two people edit the same appointment. This layout change does not alter save/merge behaviour. Production editing continues to use the same optimistic concurrency (`pb_save_state`) as before — investigate any live conflict warning in context before treating preview as production-ready.
