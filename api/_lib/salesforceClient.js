/**
 * Shared Salesforce client — server-side only. READ-ONLY.
 *
 * Authenticates with the OAuth 2.0 client-credentials flow and runs SOQL SELECT
 * queries. There is intentionally no create/update/delete path here — nothing in
 * this module ever writes to Salesforce.
 *
 * Unlike the MFOS Dealer Directory, the Pre-Booking Portal pulls dealers from
 * EVERY area/territory, so SALESFORCE_OWNER_ID is NOT required (it is optional
 * and unused by the portal sync).
 *
 * Required env: SALESFORCE_INSTANCE_URL, SALESFORCE_CLIENT_ID,
 *   SALESFORCE_CLIENT_SECRET, SALESFORCE_API_VERSION (optional, defaults v60.0)
 */

// Read an env var, defensively stripping a leading "NAME=" prefix. This guards
// against pasting a full "NAME=value" line into a dashboard secret field.
export function readEnv(name) {
  let v = String(process.env[name] || '').trim()
  const prefix = `${name}=`
  if (v.startsWith(prefix)) v = v.slice(prefix.length).trim()
  return v
}

export function normalizeApiVersion(raw) {
  const v = String(raw || '').trim()
  if (!v) return 'v60.0'
  return v.startsWith('v') ? v : `v${v}`
}

// SOQL string-literal escaping for a value placed inside single quotes.
export function escapeSoql(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** Resolve the Salesforce env config, reporting any missing keys. */
export function readSalesforceEnv() {
  const instanceUrl = readEnv('SALESFORCE_INSTANCE_URL')
  const clientId = readEnv('SALESFORCE_CLIENT_ID')
  const clientSecret = readEnv('SALESFORCE_CLIENT_SECRET')
  const apiVersion = normalizeApiVersion(readEnv('SALESFORCE_API_VERSION'))

  const missing = []
  if (!instanceUrl) missing.push('SALESFORCE_INSTANCE_URL')
  if (!clientId) missing.push('SALESFORCE_CLIENT_ID')
  if (!clientSecret) missing.push('SALESFORCE_CLIENT_SECRET')

  return { instanceUrl, clientId, clientSecret, apiVersion, missing }
}

/**
 * Exchange client credentials for an access token.
 * Throws an Error with `isAuthError = true` carrying the exact Salesforce message.
 */
export async function getAccessToken({ instanceUrl, clientId, clientSecret }) {
  const tokenUrl = `${instanceUrl.replace(/\/+$/, '')}/services/oauth2/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const text = await resp.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!resp.ok || !data?.access_token) {
    const exact =
      (data && (data.error_description || data.error)) ||
      text ||
      `Salesforce token request failed with status ${resp.status}`
    const err = new Error(exact)
    err.isAuthError = true
    throw err
  }

  return {
    accessToken: data.access_token,
    instanceUrl: (data.instance_url || instanceUrl).replace(/\/+$/, ''),
  }
}

/** Describe an sObject (fields metadata). Read-only. */
export async function describeObject({ instanceUrl, accessToken, apiVersion, objectName }) {
  const url = `${instanceUrl}/services/data/${apiVersion}/sobjects/${encodeURIComponent(objectName)}/describe`
  const resp = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  })
  const text = await resp.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!resp.ok || !Array.isArray(data?.fields)) {
    throw new Error((text || `Describe ${objectName} failed (${resp.status})`).slice(0, 300))
  }
  return data
}

/** Run a single SOQL query (one page). Returns the raw query response. */
export async function runQuery({ instanceUrl, accessToken, apiVersion, soql }) {
  const url = `${instanceUrl}/services/data/${apiVersion}/query?q=${encodeURIComponent(soql)}`
  return runQueryUrl({ instanceUrl, accessToken, url })
}

/** GET an absolute query URL (used for pagination via nextRecordsUrl). */
async function runQueryUrl({ instanceUrl, accessToken, url }) {
  const absolute = url.startsWith('http') ? url : `${instanceUrl}${url}`
  const resp = await fetch(absolute, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  const text = await resp.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!resp.ok) {
    const first = Array.isArray(data) ? data[0] : data
    const msg = (first && (first.message || first.errorCode)) || text || `Query failed (${resp.status})`
    throw new Error(msg)
  }
  return data
}

/**
 * Run a SOQL query and follow pagination until all records are collected.
 * Read-only. Guards against runaway loops.
 */
export async function queryAll({ instanceUrl, accessToken, apiVersion, soql }) {
  const records = []
  let page = await runQuery({ instanceUrl, accessToken, apiVersion, soql })
  records.push(...(page?.records || []))

  for (let guard = 0; guard < 1000 && page && page.done === false && page.nextRecordsUrl; guard += 1) {
    page = await runQueryUrl({ instanceUrl, accessToken, url: page.nextRecordsUrl })
    records.push(...(page?.records || []))
  }

  return { records, totalSize: Number(page?.totalSize ?? records.length) }
}
