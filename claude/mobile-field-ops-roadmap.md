# Arrowquip TRAVEL — Mobile Field Operations roadmap

Status as of Phase 1 branch `cursor/mobile-field-ops-phase1-5ecd` (not on production).

## What already existed (PWA)
- Trip Mode phone shell (`#tripmode`), `manifest.webmanifest` start_url `/?m=1`, conservative `sw.js`
- Today / Route / Trip / Photos / More tabs
- Dealer visit pages, Dialpad call, photo capture (IndexedDB + private storage)
- PLAUD attach + `/api/process-notes` (needs `ANTHROPIC_API_KEY`)
- Visit notes/tasks, receipt OCR route, trip report print export

## Phase 1 (this branch) — preview only
- Desktop: all itinerary items compact/collapsible; Expand/Collapse cards; Prev / This Week / Next; auto-focus current week on login; highlight Today
- Mobile: Up Next card; compact expandable timeline; day/week nav; Tasks tab from visit actions; completion timestamp + reopen; photo classification chips
- Sample branded one-page report: `claude/samples/dealer-visit-report-sample.html`

## Still required (later phases)
2. PLAUD import hardening, AI analysis approval screen, structured tasks
3. Real one-page PDF generation + personal + management email (M365) — test recipient first
4. Salesforce sync + appointment prep briefs
5. Offline queue polish, notifications, direct PLAUD API if authorized
6. Native iOS/Android shells on same Supabase backend

## Production recovery (separate)
- Time-lock fix **live** on main (`0b2c7498…`)
- Lock restore from v2204 still needs signed-in console script or Supabase service-role (see `claude/handover/restore-locks-console.js`)
