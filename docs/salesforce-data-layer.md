# Arrowquip Salesforce Data Layer — Architecture & Design

> **Status:** Documentation only. No UI redesign, no new features, no changes to
> Calendar / Map / Leaders / Dealer Cards / Forecast, no migration executed, no
> pages wired. This document specifies the target design; nothing here has been
> implemented beyond the existing Master Sheet + KPI integration.

**Baseline this builds on:** Master Sheet + KPI cards read Salesforce via
`/api/salesforce-dealers`; Vercel production ready; Netlify remains production;
Salesforce is read-only; 91/95 dealers mapped.

---

## Phase 1 — Dealer Service (single server-side owner of Salesforce)

**Rule:** exactly one module authenticates with and queries Salesforce. Every
endpoint and future page consumes *its* output. Nothing else touches Salesforce.

**Module:** `api/_lib/dealerService.js`, shared by the Vercel (`api/*`) and
Netlify (`netlify/functions/*`) wrappers so the logic exists once.

**Sole responsibilities:** authenticate · read Accounts · read Opportunities ·
map fields · apply aliases · apply fallbacks · cache · return `Dealer[]`.

**Public contract**
```
getDealers({ refresh = false }) -> { dealers: Dealer[], meta: { source, count, fetchedAt, stale } }
getDealerById(sfAccountId)       -> Dealer | null
```

**Private steps:** `authenticate()` → `fetchAccounts()` → `fetchOpportunities()`
→ `mapDealer()` → `applyAliases()` → `applyFallbacks()` → `cacheGet/Set()`.

**Consumers (thin wrappers, zero SF logic):**
- `GET  /api/salesforce-dealers`  → `getDealers()`            (existing → becomes a wrapper)
- `POST /api/salesforce-refresh`  → `getDealers({refresh:true})` (new; Phase 4)
- future `GET /api/dealers/:id`   → `getDealerById()`

**Reference implementation (design only — not committed as behavior change):**
```js
// api/_lib/dealerService.js  (reference)
const cache = require('./dealerCache')
const { TEAM_TO_AREA, ALIAS_IDS, SF_ALIAS_BY_NAME } = require('./dealerConfig')

async function getDealers({ refresh = false } = {}) {
  const cached = await cache.get()
  if (cached && !refresh && cache.isFresh(cached)) return { ...cached, meta:{ ...cached.meta, stale:false } }
  try {
    const token = await authenticate()                       // client-credentials, server-only
    const [accounts, opp27, opp26] = await Promise.all([     // read-only SOQL
      fetchAccounts(token), fetchOpps(token,'2027'), fetchOppsWon(token,'2026')
    ])
    const dealers = accounts.map(a => applyFallbacks(mapDealer(a, opp27, opp26)))
    const payload = { dealers, meta:{ source:'salesforce', count:dealers.length, fetchedAt:Date.now(), stale:false } }
    await cache.set(payload)
    return payload
  } catch (e) {
    if (cached) return { ...cached, meta:{ ...cached.meta, stale:true, error:String(e) } } // serve last-good
    throw e                                                   // caller → frontend falls back to seed
  }
}
```
The current SF logic (SOQL, `TEAM_TO_AREA`, `ALIAS_IDS`, Exports
`BillingCountryCode`, `0/null → null`) moves here verbatim — relocation + single
ownership, no behavior change.

---

## Phase 2 — Standard Dealer Model

One object every page consumes. Keyed on **Salesforce Account Id**.

```ts
Dealer {
  // Identity
  sfAccountId: string           // Salesforce Account Id (PRIMARY KEY everywhere)
  name: string
  // Salesforce facts (read-only)
  territory: 'East'|'South'|'Central'|'West'|'Exports'|'Unassigned'
  territoryManager: string
  tier: string                  // "Tier 2".."New"
  dealerStage: string           // Approved | Discovery | ...
  address: string
  state: string                 // BillingStateCode
  country: string               // BillingCountryCode
  latitude: number|null
  longitude: number|null
  lastYear: number|null         // 2026 Closed-Won Prebooked_Value__c
  booking: number|null          // 2027 Prebooked_Value__c (null while Unstarted → fallback)
  loads: number|null            // 2027 Number_of_Loads__c (null while Unstarted → fallback)
  // Computed
  growth: string|number|null
  // Planner-owned
  scheduling: { assign, day, time, conf, appt, joina, dur, logi }  // keyed by sfAccountId
  meta: { visitConfirmed, atKickoff, attendees, attendeeNames, notes, suggestedWeek }
  // Provenance (computed)
  _source: 'salesforce'|'seed'
  _matchedBy: 'id'|'alias'|'name'|'unmatched'
}
```

### Field ownership

| Field | Owner | Source / rule |
|---|---|---|
| sfAccountId | **Salesforce** | `Account.Id` |
| name, territory, territoryManager, tier, dealerStage, address, state, country, latitude, longitude | **Salesforce** | Account fields (territory ← `Team__c`; tier ← `Account_Tier_Text__c`→"New"; state ← `BillingStateCode`; country ← `BillingCountryCode`, used for Exports `loc`) |
| lastYear | **Salesforce** | Opportunity 2026 Closed-Won `Prebooked_Value__c` |
| booking, loads | **Salesforce + fallback** | Opportunity 2027; **0/null → planner seed fallback** |
| growth | **Computed** | derived from loads / booking / lastYear |
| scheduling.* | **Planner** | local only (Supabase `prebooking_state` + localStorage); never sent to SF |
| meta.* | **Planner** | local only (visitConfirmed, atKickoff, attendees, notes, suggestedWeek) |
| _source, _matchedBy | **Computed** | provenance / QA |

---

## Phase 3 — Remove dependency on dealer names (migration PLAN — not executed)

**Today:** planner `DEALERS` keyed by seed id (`D001`…); scheduling maps
(`ASSIGN[id]`, `DAY[id]`, `TIME[id]`, …) use seed ids; Salesforce is joined by
**name + a 5-entry alias map**. Fragile: depends on name normalization; the 4
unmatched dealers have no SF link.

**Target:** everything keyed by **Salesforce Account Id**; seed kept only as an
offline fallback.

- **What changes:** scheduling storage rekeys `seedId → sfAccountId`; `DEALERS`
  becomes SF-sourced; name/alias matching retired (identity is the join).
- **What breaks (if done naïvely):** existing `prebooking_state` / localStorage
  keyed by seed id become orphaned; the **4 unmatched** dealers (Maverick, Farm
  Systems Alabama, PAC, TNT Manufacturing) have no SF id and need a synthetic
  `local:` id; duplicate SF accounts (`"- YK"`) risk double-mapping; concurrent
  multi-user realtime writes mid-migration could split keys.
- **Risks:** wrong crosswalk → scheduling attached to the wrong dealer; data loss
  if not backed up; concurrent edits during cutover.
- **Rollback:** snapshot `prebooking_state` before starting; run **additive**
  (write new `sfAccountId` keys while keeping old seed keys) so nothing is
  destroyed until verified; rollback = restore snapshot / ignore new keys.
- **Implementation order:**
  1. Build & review the `seedId → sfAccountId` crosswalk (from the current 91/95
     match + alias map).
  2. Snapshot / backup `prebooking_state`.
  3. Dual-key **read** (accept both key forms).
  4. Dual-key **write** (write `sfAccountId`, keep seed).
  5. Verify counts + spot-check per territory.
  6. Flip reads to `sfAccountId`-primary.
  7. Clean up seed keys after a soak period. Unmatched dealers keep a `local:` id
     until they gain a Salesforce Account.

---

## Phase 4 — Server-side cache

- **Read model:** cache the mapped `Dealer[]`, not raw Salesforce.
- **TTL:** default 10 min (configurable 5–15).
- **Store:** shared across serverless instances — Supabase table
  `dealer_cache(id text pk, payload jsonb, fetched_at timestamptz)` (or Vercel
  KV). Shared beats per-lambda memory (cold / inconsistent).
- **Endpoints:**
  - `GET  /api/salesforce-dealers` — serve cache if fresh; else refresh → cache → serve.
  - `POST /api/salesforce-refresh` (gated) — force refresh, bypass TTL.
- **Graceful failure (stale-while-error):** on SF error, serve **last-good cache**
  with `meta.stale=true`; if no cache exists, return an error **and the frontend
  falls back to the seed** — the planner keeps working.
- **Resilience guarantee:** the planner already falls back to seed / localStorage
  when `/api` errors, so **the planner remains fully usable if Salesforce is
  down**; scheduling never depends on SF availability.
- **Security:** credentials in server env only; responses contain only the
  whitelisted Dealer fields (no PII, no raw financials, no tokens); read-only;
  refresh endpoint gated.

---

## Phase 5 — Architecture

**Current**
```
index.html (self-contained planner; Supabase via CDN + localStorage)
  ├─ fetch /api/salesforce-dealers → Vercel  api/salesforce-dealers.js  ─┐
  ├─ (Netlify) /api/salesforce-dealers → netlify/functions/*.mjs         ├─► Salesforce (read-only, client-credentials)
  ├─ merge (sfMasterMerge) into Master Sheet + KPI, matched by name/alias ┘
  └─ scheduling → Supabase prebooking_state + localStorage (seed ids)
```
Two parallel SF implementations with duplicated logic; joined by name/alias.

**Proposed**
```
Frontend (UI unchanged) ── calls only ──► /api/* endpoints
                                            └─ dealerService.getDealers()  ── ONLY Salesforce caller
                                                  ├─ cache (Supabase dealer_cache / KV, 10-min TTL, stale-on-error)
                                                  └─ Salesforce (read-only)
scheduling ──► Supabase prebooking_state (keyed by sfAccountId after Phase 3)
```
Single Dealer Service, single Dealer model, shared cache, one identity key.

**Data flow:** page → `/api/salesforce-dealers` → dealerService → (cache fresh ?
serve : SF fetch → map → alias → fallback → cache) → standardized `Dealer[]` →
page merges by `sfAccountId`.

**Security:** SF creds server-only (verified 0 in shipped HTML); mapping
whitelists fields (no PII / financial / user-directory leakage); access-gate
token on data endpoints; read-only end-to-end; refresh endpoint gated.

**API endpoints:** `GET /api/salesforce-dealers` (cached list) ·
`POST /api/salesforce-refresh` (force refresh) · future `GET /api/dealers/:id`.
All delegate to `dealerService`.

**Cache strategy:** see Phase 4 (10-min TTL, shared store, manual refresh,
stale-while-error, seed fallback).

**Future integration order:** Territory Tabs → Map → Dealer Cards → Forecast →
Calendar. Every page consumes the same `Dealer` object; none query Salesforce
directly.

---

## Roadmap — remaining pages (exact order; not started)

| # | Page | Consumes | Notes / dependency |
|---|---|---|---|
| 1 | **Territory Tabs** | `territory, tm, tier, state, address, lastYear` | Partially wired via `sfMasterMerge`; formalize onto the Dealer Service + `sfAccountId` keying first. Lowest risk. |
| 2 | **Map** | `latitude, longitude, territory, name, tier` | Most matched dealers have geo; Exports / some domestic lack coords → keep seed / geocode fallback. |
| 3 | **Dealer Cards** | `name, loc, tier, booking(fallback), loads(fallback), address, meta.visitConfirmed` | Card component reused in pool + placements; overlay at the component once the Service is in place. |
| 4 | **Forecast** | `booking, loads, lastYear, growth` + goal | Waits on real 2027 `Prebooked_Value__c` populating (currently Unstarted → fallback). Growth is computed. |
| 5 | **Calendar** | `name` + `scheduling.*` | Highest-touch scheduling surface; do last, after `sfAccountId` keying is proven so week/day/time bindings are stable. |

**Sequencing principle:** land the Dealer Service (Phase 1) + Dealer model
(Phase 2) + cache (Phase 4) first; execute the Account-Id migration (Phase 3)
before Calendar; then wire pages 1→5, each reading only the standardized
`Dealer` object.
