# Arrowquip TRAVEL — Mobile Field Operations roadmap

**Do not merge to production until Mark approves.**

## Branches
| Branch | Scope | Status |
|--------|--------|--------|
| `cursor/mobile-field-ops-phase1-5ecd` | Phase 1 UX | Draft PR #3 — preview |
| `cursor/mobile-visit-workflow-5ecd` | Phases 2–3 visit workflow + PDF + test email | Draft PR — preview |
| `main` | Production | TLE fix only |

## What already existed (PWA)
- Trip Mode phone shell (`#tripmode`), `manifest.webmanifest` start_url `/?m=1`, conservative `sw.js`
- Today / Route / Trip / Photos / More tabs
- Dealer visit pages, Dialpad call, photo capture (IndexedDB + private storage)
- PLAUD attach + `/api/process-notes` (needs `ANTHROPIC_API_KEY`)
- Visit notes/tasks, receipt OCR route, trip report print export

## Phase 1 — preview only
- Desktop: compact/collapsible itinerary; week nav; current week on login
- Mobile: Up Next; Tasks tab; completion + reopen; photo chips
- Sample HTML report retained under `claude/samples/`

## Phases 2–3 (this workflow branch) — preview only
- Demo mode: `?fieldOpsDemo=1` (or `&fieldOpsDemo=1`) — fixture Riverside visit; **does not write live plan**
- Complete Appointment stepper: Meeting → Analysis → Tasks → Approve
- Photos + PLAUD transcript upload; AI analysis with local demo fallback
- Functional PDF: `POST /api/visit-report-pdf` (`pdf-lib`) + client local builder fallback
- Email: `POST /api/visit-report-email` — **default dry-run / send disabled**; allowlist + `FIELD_OPS_EMAIL_SEND_ENABLED` required for any real send; Graph reserved for IT approval
- Safety helpers: `api/_lib/fieldOpsSafety.js`

## Preview test path
1. Open mobile Trip Mode with `fieldOpsDemo=1`
2. See Next appointment (Riverside)
3. Navigate / Call / Complete Appointment
4. Photos + PLAUD → Generate analysis → approve tasks
5. Generate PDF → Approve (email dry-run) → back to Today

## Still required (later)
4. Salesforce sync + appointment prep briefs  
5. Offline queue polish, notifications, direct PLAUD API if authorized  
6. Native shells; M365 distribution after management approval  

## Production recovery (separate — no write yet)
- Time-lock fix **live** on main  
- Lock restore: dry-run only — see `claude/handover/LOCK_RESTORE_SAFEGUARDS.md`
