# Desktop Trips Kanban layout

**Preview only — do not merge to production until Mark approves.**

## Layout
- Compact List (default) and Board views — Board / List toggle.
- Collapsible week sidebar (Year → Quarter → Month → Week), single-line weeks: `WK 47 · Nov 15–21 · 5`.
- Collapsible / resizable map (Off → Split → Full).
- One toolbar: Sidebar | ‹ | This Week | › | week label | Collapse/Expand | Board/List | Map | Confirm | Trip plan | History.
- Device-local chrome only (`aqFocusWk`, `aqTripsView`, `aqNavOpen`, `aqMapMode`, `aqMapSplit`, `aqWkGroups`).

## Sync
- System Health includes a **Trip Plan** check that mirrors real cloud sync state.
- Production never auto-seeds a missing plan row (blocks overwrite of live data).
- Saves refused when version is not loaded (`undefined` / blocked `null`).
