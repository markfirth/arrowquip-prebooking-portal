/**
 * Deliverable 3 — read-only full mapped dealer list for the Master Sheet.
 * GET /api/salesforce-dealers?k=<TOKEN>
 *
 * READ-ONLY. Authenticates server-side with the existing SALESFORCE_* Netlify
 * env vars (never exposed to the browser). Returns every dealer whose Team__c
 * maps to one of the five areas, joined to its 2027 pre-booking Opportunity and
 * its 2026 Closed-Won pre-booking, mapped into the exact planner dealer shape.
 * Does NOT write to Salesforce, Supabase, or localStorage. Access-gated.
 *
 * Field rules (approved, Deliverable 3):
 *   Salesforce-driven: id, name, territory, tm, loc, address, tier, lastYear,
 *                      lat, lon.
 *   booking/loads:     included but 0/null → null (planner keeps its fallback).
 *   Everything else is left for the planner (never sourced here).
 */

const ACCESS_TOKEN = 'aq-d3-4e8a1f60d9b2' // access gate embedded in the frontend, not a credential

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
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0 }

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

/** Read-only SOQL, following pagination. */
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
    if (!resp.ok || !Array.isArray(data?.records)) throw new Error((text || `query failed ${resp.status}`).slice(0, 300))
    out.push(...data.records)
    url = data.done === false && data.nextRecordsUrl ? data.nextRecordsUrl : null
  }
  return out
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
    loads: loadsRaw > 0 ? loadsRaw : null,
    booking: bookingRaw > 0 ? bookingRaw : null,
    lastYear: lastYearRaw > 0 ? lastYearRaw : null,
    lat: acc.BillingLatitude != null ? Number(acc.BillingLatitude) : null,
    lon: acc.BillingLongitude != null ? Number(acc.BillingLongitude) : null,
    _source: 'salesforce',
  }
}

export default async function handler(req) {
  const url = new URL(req.url)
  if (url.searchParams.get('k') !== ACCESS_TOKEN) return json({ ok: false, error: 'Not found' }, 404)

  try {
    const { accessToken, instanceUrl } = await getToken()
    const base = `${instanceUrl}/services/data/${apiVersion()}`
    const teamList = Object.keys(TEAM_TO_AREA).map((t) => `'${t}'`).join(', ')

    // One-shot diagnostic to choose the right "real dealer" filter.
    if (url.searchParams.get('counts')) {
      async function cnt(where) {
        const recs = await queryAll(base, instanceUrl, accessToken, `SELECT COUNT(Id) c FROM Account WHERE ${where}`)
        return recs?.[0]?.c ?? recs?.[0]?.expr0 ?? null
      }
      const counts = {
        team_only: await cnt(`Team__c IN (${teamList})`),
        team_and_tier: await cnt(`Team__c IN (${teamList}) AND Account_Tier__c != null`),
        team_and_dealerStage: await cnt(`Team__c IN (${teamList}) AND Dealer_Stage__c != null`),
        team_and_approved: await cnt(`Team__c IN (${teamList}) AND Dealer_Stage__c = 'Approved'`),
        team_and_becameDealer: await cnt(`Team__c IN (${teamList}) AND Became_A_Dealer_Date__c != null`),
        prebooked_pc: await cnt(`Prebooked_Dealer__pc = true`),
      }
      return json({ ok: true, counts })
    }

    // The pre-booking dealer universe = Accounts that have a 2027 pre-booking
    // Opportunity (one per dealer). This matches the planner's dealer set,
    // rather than every account that merely has a Team__c.
    const [opp27, opp26] = await Promise.all([
      queryAll(base, instanceUrl, accessToken,
        `SELECT AccountId, Prebooked_Value__c, Number_of_Loads__c FROM Opportunity WHERE Prebooking_Year__c = '2027'`),
      queryAll(base, instanceUrl, accessToken,
        `SELECT AccountId, Prebooked_Value__c FROM Opportunity WHERE Prebooking_Year__c = '2026' AND StageName = 'Closed Won'`),
    ])

    const by27 = {}; opp27.forEach((o) => { if (o.AccountId) by27[o.AccountId] = o })
    const by26 = {}; opp26.forEach((o) => { if (o.AccountId && (!by26[o.AccountId] || num(o.Prebooked_Value__c) > num(by26[o.AccountId].Prebooked_Value__c))) by26[o.AccountId] = o })

    const dealerIds = Object.keys(by27)
    // Fetch those accounts in chunks (keeps the SOQL IN() / URL length safe).
    const fields = `Id, Name, Team__c, Territory_Manager__c, Account_Tier_Text__c, BillingStreet, BillingCity, BillingState, BillingStateCode, BillingLatitude, BillingLongitude`
    const accounts = []
    for (let i = 0; i < dealerIds.length; i += 150) {
      const chunk = dealerIds.slice(i, i + 150).map((id) => `'${id}'`).join(', ')
      const recs = await queryAll(base, instanceUrl, accessToken, `SELECT ${fields} FROM Account WHERE Id IN (${chunk}) AND Name != '- -'`)
      accounts.push(...recs)
    }

    const dealers = accounts.map((a) => mapDealer(a, by27[a.Id], by26[a.Id])).filter((d) => d.territory)

    return json({ ok: true, count: dealers.length, prebookingOpps2027: dealerIds.length, dealers })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e), missing: e?.missing || [] }, e?.missing ? 500 : 502)
  }
}

export const config = { path: '/api/salesforce-dealers' }
