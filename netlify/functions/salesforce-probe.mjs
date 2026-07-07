/**
 * TEMPORARY read-only Salesforce discovery probe. To be removed after mapping.
 * READ-ONLY: authenticates (client-credentials), lists/describes objects, and
 * runs SELECT ... LIMIT queries. No create/update/delete anywhere. Never writes
 * to Salesforce, Supabase, or localStorage. Never returns secrets/tokens.
 *
 * Access-gated by a one-off token so the endpoint isn't openly scrapeable while
 * it exists. Uses only the existing SALESFORCE_* Netlify env vars.
 *
 *   GET /api/salesforce-probe?k=<TOKEN>
 *       → list queryable objects (custom flagged) + keyword-matched candidates.
 *   GET /api/salesforce-probe?k=<TOKEN>&obj=<ApiName>
 *       → describe fields (label, apiName, type, custom, referenceTo) + 5 samples.
 */

const ACCESS_TOKEN = 'aq-probe-3f9c1a7e5d24' // temporary gate, not a credential

const KEYWORDS = [
  'forecast', 'prebook', 'pre_book', 'pre-book', 'booking', 'load', 'slot',
  'dealer', 'inventory', 'territory', 'score', 'plan', 'order', 'registration',
]

const UNSELECTABLE = new Set(['address', 'location', 'base64', 'complexvalue'])

function readEnv(name) {
  let v = String(process.env[name] || '').trim()
  const p = `${name}=`
  if (v.startsWith(p)) v = v.slice(p.length).trim()
  return v
}
function apiVersion() {
  const v = readEnv('SALESFORCE_API_VERSION')
  if (!v) return 'v60.0'
  return v.startsWith('v') ? v : `v${v}`
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

async function getToken() {
  const instanceUrl = readEnv('SALESFORCE_INSTANCE_URL')
  const clientId = readEnv('SALESFORCE_CLIENT_ID')
  const clientSecret = readEnv('SALESFORCE_CLIENT_SECRET')
  const missing = []
  if (!instanceUrl) missing.push('SALESFORCE_INSTANCE_URL')
  if (!clientId) missing.push('SALESFORCE_CLIENT_ID')
  if (!clientSecret) missing.push('SALESFORCE_CLIENT_SECRET')
  if (missing.length) throw new Error(`Missing env: ${missing.join(', ')}`)

  const resp = await fetch(`${instanceUrl.replace(/\/+$/, '')}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
  })
  const text = await resp.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  if (!resp.ok || !data?.access_token) {
    throw new Error((data && (data.error_description || data.error)) || text || `token failed ${resp.status}`)
  }
  return { accessToken: data.access_token, instanceUrl: (data.instance_url || instanceUrl).replace(/\/+$/, '') }
}

async function sfGet(url, accessToken) {
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } })
  const text = await resp.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  return { ok: resp.ok, status: resp.status, data, text }
}

function truncate(v) {
  if (typeof v === 'string' && v.length > 200) return `${v.slice(0, 200)}…`
  return v
}

export default async function handler(req) {
  const url = new URL(req.url)
  if (url.searchParams.get('k') !== ACCESS_TOKEN) return json({ ok: false, error: 'Not found' }, 404)

  const V = apiVersion()
  try {
    const { accessToken, instanceUrl } = await getToken()
    const base = `${instanceUrl}/services/data/${V}`
    const obj = String(url.searchParams.get('obj') || '').trim()

    // Mode A: list objects + keyword candidates.
    if (!obj) {
      const g = await sfGet(`${base}/sobjects/`, accessToken)
      if (!g.ok || !Array.isArray(g.data?.sobjects)) return json({ ok: false, error: 'Could not list objects' }, 502)
      const all = g.data.sobjects.filter((o) => o.queryable).map((o) => ({ name: o.name, label: o.label, custom: !!o.custom }))
      const candidates = all.filter((o) => {
        const hay = `${o.name} ${o.label}`.toLowerCase()
        return KEYWORDS.some((k) => hay.includes(k))
      })
      const custom = all.filter((o) => o.custom)
      return json({ ok: true, mode: 'objects', total: all.length, candidates, customObjects: custom })
    }

    // Mode B: describe one object + up to 5 samples.
    if (!/^[A-Za-z0-9_]+$/.test(obj)) return json({ ok: false, error: 'bad obj' }, 400)
    const desc = await sfGet(`${base}/sobjects/${encodeURIComponent(obj)}/describe`, accessToken)
    if (!desc.ok || !Array.isArray(desc.data?.fields)) {
      return json({ ok: false, error: (desc.text || `describe failed ${desc.status}`).slice(0, 200), status: desc.status }, desc.status === 403 ? 403 : 502)
    }
    const fields = desc.data.fields.map((f) => ({
      label: f.label,
      api: f.name,
      type: f.type,
      custom: !!f.custom,
      ref: Array.isArray(f.referenceTo) && f.referenceTo.length ? f.referenceTo : undefined,
    }))
    const selectable = desc.data.fields
      .filter((f) => !UNSELECTABLE.has(f.type) && !f.compoundFieldName)
      .map((f) => f.name)
    const cols = ['Id', ...selectable.filter((n) => n !== 'Id')].slice(0, 60)

    let records = []
    let sampleError = ''
    try {
      const q = await sfGet(`${base}/query?q=${encodeURIComponent(`SELECT ${cols.join(', ')} FROM ${obj} LIMIT 5`)}`, accessToken)
      if (q.ok && Array.isArray(q.data?.records)) {
        records = q.data.records.map((r) => {
          const clean = {}
          for (const k of Object.keys(r)) { if (k !== 'attributes') clean[k] = truncate(r[k]) }
          return clean
        })
      } else {
        sampleError = (q.text || `query failed ${q.status}`).slice(0, 200)
      }
    } catch (e) {
      sampleError = e instanceof Error ? e.message : String(e)
    }

    return json({ ok: true, mode: 'object', object: obj, fieldCount: fields.length, fields, sampleCount: records.length, records, sampleError })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502)
  }
}

export const config = { path: '/api/salesforce-probe' }
