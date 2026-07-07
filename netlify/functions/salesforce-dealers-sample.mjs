/**
 * Deliverable 2 — read-only Salesforce → planner-shape sample.
 * GET /api/salesforce-dealers-sample?k=<TOKEN>[&limit=N]
 *
 * READ-ONLY. Authenticates server-side with the existing SALESFORCE_* Netlify
 * env vars (never exposed to the browser), reads a few dealers + their
 * pre-booking Opportunities, and returns them mapped into the EXACT planner
 * dealer shape. It does NOT write to Salesforce, Supabase, or localStorage, and
 * does not touch the UI. Access-gated by a one-off token.
 *
 * Mapping (approved):
 *   territory  ← Account.Team__c            (Eastern Eagles→East, Southern
 *                                            Sharks→South, Central Coyotes→
 *                                            Central, Western Wildcats→West,
 *                                            Exports→Exports)
 *   tm         ← Account.Territory_Manager__c
 *   name       ← Account.Name
 *   loc        ← Account.BillingStateCode
 *   address    ← BillingStreet, BillingCity, BillingState
 *   tier       ← Account.Account_Tier_Text__c  (null → "New")
 *   lat / lon  ← Account.BillingLatitude / BillingLongitude
 *   booking    ← 2027 Opportunity.Prebooked_Value__c   (0/null → null = keep seed fallback)
 *   loads      ← 2027 Opportunity.Number_of_Loads__c   (0/null → null = keep seed fallback)
 *   lastYear   ← 2026 Opportunity.Prebooked_Value__c, StageName='Closed Won' (else null)
 *   growth/risk/visitConfirmed/atKickoff/attendees/attendeeNames/suggestedWeek
 *              → null  (planner-local or fallback; never overwritten here)
 */

const ACCESS_TOKEN = 'aq-d2-7b41e9c2f8a6' // temporary access gate, not a credential

const TEAM_TO_AREA = {
  'Eastern Eagles': 'East',
  'Southern Sharks': 'South',
  'Central Coyotes': 'Central',
  'Western Wildcats': 'West',
  Exports: 'Exports',
}

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
function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

async function getToken() {
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
  if (!resp.ok || !data?.access_token) throw new Error((data && (data.error_description || data.error)) || `token failed ${resp.status}`)
  return { accessToken: data.access_token, instanceUrl: (data.instance_url || instanceUrl).replace(/\/+$/, '') }
}

async function soql(base, accessToken, query) {
  const resp = await fetch(`${base}/query?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  })
  const text = await resp.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  if (!resp.ok || !Array.isArray(data?.records)) throw new Error((text || `query failed ${resp.status}`).slice(0, 300))
  return data.records
}

function mapDealer(acc, opp27, opp26won) {
  const bookingRaw = opp27 ? num(opp27.Prebooked_Value__c) : 0
  const loadsRaw = opp27 ? num(opp27.Number_of_Loads__c) : 0
  const lastYearRaw = opp26won ? num(opp26won.Prebooked_Value__c) : 0
  return {
    id: acc.Id,
    territory: TEAM_TO_AREA[acc.Team__c] || null,
    tm: acc.Territory_Manager__c || '',
    name: acc.Name || '',
    loc: acc.BillingStateCode || acc.BillingState || '',
    address: [acc.BillingStreet, acc.BillingCity, acc.BillingState].filter(Boolean).join(', '),
    tier: acc.Account_Tier_Text__c || 'New',
    // 0/null Salesforce values → null so the planner keeps its seeded fallback:
    loads: loadsRaw > 0 ? loadsRaw : null,
    booking: bookingRaw > 0 ? bookingRaw : null,
    lastYear: lastYearRaw > 0 ? lastYearRaw : null,
    growth: null, // derived/fallback
    risk: null, // fallback only
    visitConfirmed: null, // planner-local (scheduling) — never from SF
    atKickoff: null, // planner-local
    attendees: null, // planner-local/fallback
    attendeeNames: null, // fallback
    suggestedWeek: null, // planner-local
    lat: acc.BillingLatitude != null ? Number(acc.BillingLatitude) : null,
    lon: acc.BillingLongitude != null ? Number(acc.BillingLongitude) : null,
    _source: 'salesforce',
  }
}

export default async function handler(req) {
  const url = new URL(req.url)
  if (url.searchParams.get('k') !== ACCESS_TOKEN) return json({ ok: false, error: 'Not found' }, 404)

  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '5', 10) || 5, 1), 10)

  const env = {
    SALESFORCE_INSTANCE_URL: !!readEnv('SALESFORCE_INSTANCE_URL'),
    SALESFORCE_CLIENT_ID: !!readEnv('SALESFORCE_CLIENT_ID'),
    SALESFORCE_CLIENT_SECRET: !!readEnv('SALESFORCE_CLIENT_SECRET'),
    SALESFORCE_API_VERSION: apiVersion(),
  }

  try {
    const { accessToken, instanceUrl } = await getToken()
    const base = `${instanceUrl}/services/data/${apiVersion()}`

    // A few real dealers in the five mapped teams.
    const teamList = Object.keys(TEAM_TO_AREA).map((t) => `'${t}'`).join(', ')
    const accounts = await soql(
      base,
      accessToken,
      `SELECT Id, Name, Team__c, Territory_Manager__c, Account_Tier_Text__c, BillingStreet, BillingCity, BillingState, BillingStateCode, BillingLatitude, BillingLongitude
       FROM Account WHERE Team__c IN (${teamList}) ORDER BY Name LIMIT ${limit}`,
    )
    if (!accounts.length) return json({ ok: true, env, count: 0, dealers: [], note: 'No accounts with a mapped Team__c found.' })

    const ids = accounts.map((a) => `'${a.Id}'`).join(', ')
    const opp27 = await soql(base, accessToken, `SELECT AccountId, Prebooked_Value__c, Number_of_Loads__c FROM Opportunity WHERE Prebooking_Year__c = '2027' AND AccountId IN (${ids})`)
    const opp26 = await soql(base, accessToken, `SELECT AccountId, Prebooked_Value__c FROM Opportunity WHERE Prebooking_Year__c = '2026' AND StageName = 'Closed Won' AND AccountId IN (${ids})`)

    const by27 = {}; opp27.forEach((o) => { by27[o.AccountId] = o })
    const by26 = {}; opp26.forEach((o) => { if (!by26[o.AccountId] || num(o.Prebooked_Value__c) > num(by26[o.AccountId].Prebooked_Value__c)) by26[o.AccountId] = o })

    const dealers = accounts.map((a) => mapDealer(a, by27[a.Id], by26[a.Id])).filter((d) => d.territory)

    return json({
      ok: true,
      env,
      count: dealers.length,
      nullMeans: 'booking/loads/lastYear = null → no Salesforce value yet; planner keeps its existing seeded fallback (per approved rule).',
      dealers,
    })
  } catch (e) {
    return json({ ok: false, env, error: e instanceof Error ? e.message : String(e), missing: e?.missing || [] }, e?.missing ? 500 : 502)
  }
}

export const config = { path: '/api/salesforce-dealers-sample' }
