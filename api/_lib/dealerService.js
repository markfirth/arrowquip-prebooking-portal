/**
 * Dealer Service — the SINGLE server-side owner of Salesforce.
 *
 * This is the only module that authenticates with and queries Salesforce.
 * Every endpoint (Vercel api/* and Netlify netlify/functions/*) and every future
 * page consumes this module's output. Nothing else queries Salesforce directly.
 *
 * READ-ONLY (auth + SELECT only; never writes to Salesforce). Credentials come
 * from server-side env vars and are never returned. Includes a 10-minute
 * in-process cache with stale-while-error fallback, so the planner keeps working
 * (from cache or its own seed fallback) when Salesforce is briefly unavailable.
 *
 * CommonJS so it can be required by the Vercel Node routes and imported by the
 * Netlify ESM functions alike.
 */

// Access gate for the data endpoints (embedded in the frontend — NOT a credential).
const ACCESS_TOKEN = 'aq-d3-4e8a1f60d9b2'
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

const TEAM_TO_AREA = {
  'Eastern Eagles': 'East',
  'Southern Sharks': 'South',
  'Central Coyotes': 'Central',
  'Western Wildcats': 'West',
  Exports: 'Exports',
}

// Territory is driven by the Salesforce Territory Manager. Managers not listed here
// (e.g. Denver Logan, Jerry Langrell) yield a blank territory — the dealer still appears
// in the Master Sheet, just without a territory assignment.
const TM_TO_AREA = {
  'Mark Firth': 'East',
  'Dane Firth': 'South',
  'Dale Cornell': 'Central',
  'Darren Brennan': 'West',
  'Andrew Firth': 'Exports',
}

// Explicit HIGH-confidence aliases (approved). Ensures these accounts are always
// returned even if untiered, so the frontend alias map resolves them by Id.
const ALIAS_IDS = [
  '001ON00000B7wIrYAJ', // Capital Tractor Inc.
  '001ON00000JHefBYAT', // High Point Stockman Supply
  '001ON00000LOKjEYAX', // Southern States Co-op - Stanford
  '001ON00000JHTrpYAH', // Stenberg's Trailers & Cattle Supply
  '001ON00000Jyc9NYAR', // Cattleman's Resource
]

// ── env / helpers ──────────────────────────────────────────────────────────
function readEnv(name) {
  let v = String(process.env[name] || '').trim()
  const p = `${name}=`
  if (v.startsWith(p)) v = v.slice(p.length).trim()
  return v
}
function apiVersion() {
  const v = readEnv('SALESFORCE_API_VERSION')
  return !v ? 'v60.0' : v.startsWith('v') ? v : `v${v}`
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }

// ── Salesforce auth (client-credentials, read-only) ──────────────────────────
async function authenticate() {
  const instanceUrl = readEnv('SALESFORCE_INSTANCE_URL')
  const clientId = readEnv('SALESFORCE_CLIENT_ID')
  const clientSecret = readEnv('SALESFORCE_CLIENT_SECRET')
  const missing = []
  if (!instanceUrl) missing.push('SALESFORCE_INSTANCE_URL')
  if (!clientId) missing.push('SALESFORCE_CLIENT_ID')
  if (!clientSecret) missing.push('SALESFORCE_CLIENT_SECRET')
  if (missing.length) { const e = new Error(`Missing env: ${missing.join(', ')}`); e.missing = missing; throw e }
  const resp = await fetch(`${instanceUrl.replace(/\/+$/, '')}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
  })
  const text = await resp.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  if (!resp.ok || !data || !data.access_token) throw new Error((data && (data.error_description || data.error)) || `token failed ${resp.status}`)
  return { accessToken: data.access_token, instanceUrl: (data.instance_url || instanceUrl).replace(/\/+$/, '') }
}

// ── read-only SOQL with pagination ───────────────────────────────────────────
async function queryAll(base, instanceUrl, accessToken, query) {
  const out = []
  let url = `${base}/query?q=${encodeURIComponent(query)}`
  for (let guard = 0; guard < 200 && url; guard += 1) {
    const resp = await fetch(url.startsWith('http') ? url : `${instanceUrl}${url}`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    })
    const text = await resp.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { data = null }
    if (!resp.ok || !data || !Array.isArray(data.records)) throw new Error((text || `query failed ${resp.status}`).slice(0, 300))
    out.push(...data.records)
    url = data.done === false && data.nextRecordsUrl ? data.nextRecordsUrl : null
  }
  return out
}

// ── mapping → standardized Dealer object ─────────────────────────────────────
function computeGrowth(booking, lastYear) {
  if (booking > 0 && lastYear > 0) { const pct = Math.round(((booking - lastYear) / lastYear) * 100); return (pct >= 0 ? '+' : '') + pct + '%' }
  return null
}

/**
 * Standardized Dealer. Keeps the existing wire keys (id, territory, tm, name,
 * loc, address, tier, loads, booking, lastYear, lat, lon) so the current
 * Master Sheet / KPI contract is preserved, and adds the Phase-2 standardized
 * fields (sfAccountId, dealerStage, state, country, latitude, longitude, growth)
 * for future pages. booking/loads are null when the 2027 Salesforce value is
 * 0/null so the planner keeps its seed fallback.
 */
function mapDealer(acc, opp27, opp26won, prebook2026) {
  const bookingRaw = opp27 ? num(opp27.Prebooked_Value__c) : 0
  const loadsRaw = opp27 ? num(opp27.Number_of_Loads__c) : 0
  const lastYearRaw = opp26won ? num(opp26won.Prebooked_Value__c) : 0
  const area = TM_TO_AREA[acc.Territory_Manager__c] || null

  let loc = acc.BillingStateCode || ''
  if (!loc && area === 'Exports') loc = acc.BillingCountryCode || '' // Exports: country code when no state
  if (!loc) loc = acc.BillingState || ''

  const booking = bookingRaw > 0 ? bookingRaw : null
  const loads = loadsRaw > 0 ? loadsRaw : null
  const lastYear = lastYearRaw > 0 ? lastYearRaw : null
  const lat = acc.BillingLatitude != null ? Number(acc.BillingLatitude) : null
  const lon = acc.BillingLongitude != null ? Number(acc.BillingLongitude) : null

  return {
    // existing wire contract (do not remove — Master Sheet / KPI depend on these)
    id: acc.Id,
    territory: area,
    tm: acc.Territory_Manager__c || '',
    name: acc.Name || '',
    loc,
    address: [acc.BillingStreet, acc.BillingCity, acc.BillingState].filter(Boolean).join(', '),
    tier: acc.Account_Tier_Text__c || 'New',
    loads,
    booking,
    lastYear,
    // 2026 Pre-Booking Original Commitment — Salesforce-derived COUNT of Dealer Loads
    // opportunities (Production_Estimated_Ship_Date__c in 2026, stage Closed Won or
    // Prebooked). Locked/non-editable in the Master Sheet. Always a number.
    prebook2026: num(prebook2026),
    lat,
    lon,
    _source: 'salesforce',
    // standardized Phase-2 additions (safe superset; future pages)
    sfAccountId: acc.Id,
    dealerStage: acc.Dealer_Stage__c || null,
    state: acc.BillingStateCode || null,
    country: acc.BillingCountryCode || null,
    latitude: lat,
    longitude: lon,
    growth: computeGrowth(booking || 0, lastYear || 0),
  }
}

// ── one full read: auth + Accounts + Opportunities → Dealer[] ────────────────
async function fetchAllDealers() {
  const { accessToken, instanceUrl } = await authenticate()
  const base = `${instanceUrl}/services/data/${apiVersion()}`
  const teamList = Object.keys(TEAM_TO_AREA).map((t) => `'${t}'`).join(', ')
  const aliasIn = ALIAS_IDS.map((id) => `'${id}'`).join(', ')
  const fields = `Id, Name, Team__c, Territory_Manager__c, Account_Tier_Text__c, Dealer_Stage__c, BillingStreet, BillingCity, BillingState, BillingStateCode, BillingCountryCode, BillingLatitude, BillingLongitude`

  const [accounts, opp27, opp26, pb26] = await Promise.all([
    queryAll(base, instanceUrl, accessToken,
      `SELECT ${fields} FROM Account WHERE RecordType.Name = 'Arrowquip Dealer'`),
    queryAll(base, instanceUrl, accessToken,
      `SELECT AccountId, Prebooked_Value__c, Number_of_Loads__c FROM Opportunity WHERE Prebooking_Year__c = '2027'`),
    queryAll(base, instanceUrl, accessToken,
      `SELECT AccountId, Prebooked_Value__c FROM Opportunity WHERE Prebooking_Year__c = '2026' AND StageName = 'Closed Won'`),
    // 2026 Pre-Booking Original Commitment = COUNT of Dealer Loads opportunities per dealer.
    // RecordType.Name = 'Dealer Loads' excludes Small Sales / Commercial / End User / Warranty /
    // Prebooking / Pre-Production / parts / non-load orders automatically. Use
    // Production_Estimated_Ship_Date__c (NOT Shipment_Date__c — that is null on prebooked loads,
    // which would make the commitment change when a load moves Prebooked → Closed Won). Each
    // Dealer Loads opportunity = 1 load. Aggregate COUNT allows the field alias; AccountId groups.
    queryAll(base, instanceUrl, accessToken,
      `SELECT AccountId, COUNT(Id) c FROM Opportunity ` +
      `WHERE RecordType.Name = 'Dealer Loads' ` +
      `AND Production_Estimated_Ship_Date__c >= 2026-01-01 ` +
      `AND Production_Estimated_Ship_Date__c <= 2026-12-31 ` +
      `AND StageName IN ('Closed Won', 'Prebooked') ` +
      `GROUP BY AccountId`),
  ])

  const by27 = {}; opp27.forEach((o) => { if (o.AccountId) by27[o.AccountId] = o })
  const by26 = {}; opp26.forEach((o) => { if (o.AccountId && (!by26[o.AccountId] || num(o.Prebooked_Value__c) > num(by26[o.AccountId].Prebooked_Value__c))) by26[o.AccountId] = o })
  const byPB = {}; pb26.forEach((o) => { if (o.AccountId) byPB[o.AccountId] = num(o.c) })

  // Return ALL Arrowquip Dealers — including those with an unmapped manager (blank territory).
  return accounts.map((a) => mapDealer(a, by27[a.Id], by26[a.Id], byPB[a.Id] || 0))
}

// ── cache (module scope, per runtime instance) + stale-while-error ───────────
let _cache = null // { dealers, fetchedAt }
function isFresh() { return !!_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS }
function withMeta(stale, extra) {
  return { dealers: _cache.dealers, meta: Object.assign({ source: 'salesforce', count: _cache.dealers.length, fetchedAt: _cache.fetchedAt, ttlMs: CACHE_TTL_MS, stale: !!stale }, extra || {}) }
}

/**
 * Return the standardized dealer list. Serves the cache when fresh; otherwise
 * refreshes from Salesforce. On a Salesforce error, serves the last-good cache
 * (stale=true) if one exists; only throws when there is no cache at all (in which
 * case the frontend keeps its seed fallback).
 */
async function getDealers(opts) {
  const refresh = !!(opts && opts.refresh)
  if (isFresh() && !refresh) return withMeta(false)
  try {
    const dealers = await fetchAllDealers()
    _cache = { dealers, fetchedAt: Date.now() }
    return withMeta(false)
  } catch (e) {
    if (_cache) return withMeta(true, { error: (e && e.message) || String(e) })
    throw e
  }
}

async function getDealerById(id) {
  const { dealers } = await getDealers({})
  return dealers.find((d) => d.sfAccountId === id || d.id === id) || null
}

module.exports = { getDealers, getDealerById, ACCESS_TOKEN, CACHE_TTL_MS }
