/**
 * Vercel API route — read-only full mapped dealer list for the Master Sheet.
 * GET /api/salesforce-dealers?k=<TOKEN>
 *
 * Adapted from netlify/functions/salesforce-dealers.mjs (identical Salesforce
 * logic). READ-ONLY. Authenticates server-side with the SALESFORCE_* env vars
 * (never exposed to the browser). Does NOT write to Salesforce/Supabase.
 */

const ACCESS_TOKEN = 'aq-d3-4e8a1f60d9b2' // access gate embedded in the frontend, not a credential

const TEAM_TO_AREA = {
  'Eastern Eagles': 'East',
  'Southern Sharks': 'South',
  'Central Coyotes': 'Central',
  'Western Wildcats': 'West',
  Exports: 'Exports',
}

const ALIAS_IDS = [
  '001ON00000B7wIrYAJ', // Capital Tractor Inc.
  '001ON00000JHefBYAT', // High Point Stockman Supply
  '001ON00000LOKjEYAX', // Southern States Co-op - Stanford
  '001ON00000JHTrpYAH', // Stenberg's Trailers & Cattle Supply
  '001ON00000Jyc9NYAR', // Cattleman's Resource
]

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
  if (!resp.ok || !data || !data.access_token) throw new Error((data && (data.error_description || data.error)) || `token failed ${resp.status}`)
  return { accessToken: data.access_token, instanceUrl: (data.instance_url || instanceUrl).replace(/\/+$/, '') }
}

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

function mapDealer(acc, opp27, opp26won) {
  const bookingRaw = opp27 ? num(opp27.Prebooked_Value__c) : 0
  const loadsRaw = opp27 ? num(opp27.Number_of_Loads__c) : 0
  const lastYearRaw = opp26won ? num(opp26won.Prebooked_Value__c) : 0
  const area = TEAM_TO_AREA[acc.Team__c] || null
  let loc = acc.BillingStateCode || ''
  if (!loc && area === 'Exports') loc = acc.BillingCountryCode || ''
  if (!loc) loc = acc.BillingState || ''
  return {
    id: acc.Id,
    territory: area,
    tm: acc.Territory_Manager__c || '',
    name: acc.Name || '',
    loc,
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

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const k = (req.query && req.query.k) || ''
  if (k !== ACCESS_TOKEN) { res.status(404).json({ ok: false, error: 'Not found' }); return }

  try {
    const { accessToken, instanceUrl } = await getToken()
    const base = `${instanceUrl}/services/data/${apiVersion()}`
    const teamList = Object.keys(TEAM_TO_AREA).map((t) => `'${t}'`).join(', ')

    const fields = `Id, Name, Team__c, Territory_Manager__c, Account_Tier_Text__c, BillingStreet, BillingCity, BillingState, BillingStateCode, BillingCountryCode, BillingLatitude, BillingLongitude`
    const aliasIn = ALIAS_IDS.map((id) => `'${id}'`).join(', ')
    const [accounts, opp27, opp26] = await Promise.all([
      queryAll(base, instanceUrl, accessToken,
        `SELECT ${fields} FROM Account WHERE (Team__c IN (${teamList}) AND Account_Tier__c != null AND Name != '- -') OR Id IN (${aliasIn})`),
      queryAll(base, instanceUrl, accessToken,
        `SELECT AccountId, Prebooked_Value__c, Number_of_Loads__c FROM Opportunity WHERE Prebooking_Year__c = '2027'`),
      queryAll(base, instanceUrl, accessToken,
        `SELECT AccountId, Prebooked_Value__c FROM Opportunity WHERE Prebooking_Year__c = '2026' AND StageName = 'Closed Won'`),
    ])

    const by27 = {}; opp27.forEach((o) => { if (o.AccountId) by27[o.AccountId] = o })
    const by26 = {}; opp26.forEach((o) => { if (o.AccountId && (!by26[o.AccountId] || num(o.Prebooked_Value__c) > num(by26[o.AccountId].Prebooked_Value__c))) by26[o.AccountId] = o })

    const dealers = accounts.map((a) => mapDealer(a, by27[a.Id], by26[a.Id])).filter((d) => d.territory)

    res.status(200).json({ ok: true, count: dealers.length, dealers })
  } catch (e) {
    const missing = e && e.missing ? e.missing : []
    res.status(missing.length ? 500 : 502).json({ ok: false, error: e instanceof Error ? e.message : String(e), missing })
  }
}
