# Arrowquip TRAVEL — Mobile Field Operations roadmap

**Do not merge to production until Mark approves.**

## Platform
- **PWA** (Progressive Web App): `manifest.webmanifest` + `sw.js`, phone shell `#tripmode` at ≤820px.
- Desktop planner is a separate responsive web UI in the same `index.html` — **not redesigned** by the Trip Command overhaul.
- Backend unchanged: Supabase plan state, Vercel APIs, Dialpad, Salesforce, PLAUD/`process-notes`, pdf-lib visit report.

## Branches
| Branch | Scope | Status |
|--------|--------|--------|
| `cursor/mobile-field-ops-phase1-5ecd` | Phase 1 UX | Draft PR #3 |
| `cursor/mobile-visit-workflow-5ecd` | Phases 2–3 PDF/email | Draft PR #4 |
| `cursor/mobile-trip-command-5ecd` | **Trip Command Centre overhaul** | Draft PR |
| `main` | Production | TLE fix only |

## Trip Command Centre (current overhaul)
Navigation: **Trip · Day · Tasks** only. Hierarchy: Trip → Week → Day → Appointment.

Preview: `?m=1&tripDemo=1` (or `fieldOpsDemo=1`) — Midwest fixture trip; **does not write live plan**.

### Acceptance path
1. Open app → current trip dashboard
2. Tap a day → day itinerary
3. Next appointment → Navigate / Complete
4. Optional photos / PLAUD / intelligence / branded PDF / approve (dry-run email)
5. Tasks tab for follow-ups

## Lock restore
Dry-run only — `claude/handover/LOCK_RESTORE_SAFEGUARDS.md`. No write without Mark’s approval.
