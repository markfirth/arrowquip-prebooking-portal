/**
 * TEMPORARY read-only name search to resolve the 9 unmatched Master Sheet
 * dealers. To be removed after the alias map is produced. READ-ONLY (SOSL name
 * search + describe of matches). No writes anywhere. Access-gated.
 * GET /api/salesforce-name-search?k=<TOKEN>
 */
const ACCESS_TOKEN = 'aq-alias-6d2f0b93'

const TEAM_TO_AREA = {
  'Eastern Eagles': 'East', 'Southern Sharks': 'South', 'Central Coyotes': 'Central',
  'Western Wildcats': 'West', Exports: 'Exports',
}

// planner name → SOSL search term (distinctive token)
const TARGETS = [
  { planner: 'Capital Tractor Inc.', term: 'Capital Tractor' },
  { planner: 'Maverick', term: 'Maverick' },
  { planner: 'Farm Systems Alabama', term: 'Farm Systems' },
  { planner: 'High Point Stockmans Supply', term: 'Stockmans' },
  { planner: 'Southern States - Stanford', term: 'Stanford' },
  { planner: 'PAC', term: 'PAC' },
  { planner: 'TNT Manufacturing', term: 'TNT' },
  { planner: 'Stenberg Trailers & Cattle Supply', term: 'Stenberg' },
  { planner: "Cattleman's Resource Inc", term: 'Cattleman' },
]

function readEnv(n) { let v = String(process.env[n] || '').trim(); const p = `${n}=`; if (v.startsWith(p)) v = v.slice(p.length).trim(); return v }
function apiVersion() { const v = readEnv('SALESFORCE_API_VERSION'); return !v ? 'v60.0' : v.startsWith('v') ? v : `v${v}` }
function json(b, s = 200) { return new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }) }

async function getToken() {
  const instanceUrl = readEnv('SALESFORCE_INSTANCE_URL'), clientId = readEnv('SALESFORCE_CLIENT_ID'), clientSecret = readEnv('SALESFORCE_CLIENT_SECRET')
  const resp = await fetch(`${instanceUrl.replace(/\/+$/, '')}/services/oauth2/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
  })
  const t = await resp.text(); let d = null; try { d = JSON.parse(t) } catch { d = null }
  if (!resp.ok || !d?.access_token) throw new Error((d && (d.error_description || d.error)) || `token failed ${resp.status}`)
  return { accessToken: d.access_token, instanceUrl: (d.instance_url || instanceUrl).replace(/\/+$/, '') }
}

async function sosl(base, accessToken, term) {
  const clean = term.replace(/[^A-Za-z0-9 ]+/g, ' ').trim()
  const q = `FIND {${clean}} IN NAME FIELDS RETURNING Account(Id, Name, Team__c, Territory_Manager__c, Account_Tier_Text__c, BillingState, BillingStateCode, Dealer_Stage__c ORDER BY Name LIMIT 12)`
  const resp = await fetch(`${base}/search/?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } })
  const t = await resp.text(); let d = null; try { d = JSON.parse(t) } catch { d = null }
  if (!resp.ok) throw new Error((t || `search failed ${resp.status}`).slice(0, 200))
  return (d?.searchRecords || []).map((r) => ({
    id: r.Id, name: r.Name, team: r.Team__c || null, area: TEAM_TO_AREA[r.Team__c] || null,
    tm: r.Territory_Manager__c || null, tier: r.Account_Tier_Text__c || null,
    state: r.BillingStateCode || r.BillingState || null, stage: r.Dealer_Stage__c || null,
  }))
}

export default async function handler(req) {
  const url = new URL(req.url)
  if (url.searchParams.get('k') !== ACCESS_TOKEN) return json({ ok: false, error: 'Not found' }, 404)
  try {
    const { accessToken, instanceUrl } = await getToken()
    const base = `${instanceUrl}/services/data/${apiVersion()}`

    // Ad-hoc single search: &q=<term>
    const q = String(url.searchParams.get('q') || '').trim()
    if (q) {
      let candidates = []
      let error = ''
      try { candidates = await sosl(base, accessToken, q) } catch (e) { error = e instanceof Error ? e.message : String(e) }
      return json({ ok: true, term: q, candidateCount: candidates.length, candidates, error })
    }

    const results = []
    for (const t of TARGETS) {
      let candidates = []
      let error = ''
      try { candidates = await sosl(base, accessToken, t.term) } catch (e) { error = e instanceof Error ? e.message : String(e) }
      results.push({ planner: t.planner, term: t.term, candidateCount: candidates.length, candidates, error })
    }
    return json({ ok: true, results })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502)
  }
}

export const config = { path: '/api/salesforce-name-search' }
