/**
 * Sync every Salesforce Account into the Pre-Booking Portal Dealer Directory.
 * POST /api/salesforce-dealers-sync   (Netlify Function v2)
 *
 * Auth: an authenticated Arrowquip admin (Authorization: Bearer <supabase JWT>).
 *
 * READ-ONLY against Salesforce: authenticates, describes the Account object to
 * resolve field API names, then SELECTs Accounts across EVERY area/territory
 * (no OwnerId filter). It never creates, updates, or deletes Salesforce data.
 *
 * Into Supabase it performs a settings-preserving upsert keyed on
 * salesforce_account_id (no duplicate dealer rows): only Salesforce-sourced
 * columns are written, so local admin + planner columns (visible_in_portal,
 * show_in_area_tabs, area_override, planner_data, notes) are preserved. Accounts
 * that stop appearing in Salesforce are flagged sf_present=false (never deleted).
 *
 * Uses ONLY the existing env vars — Salesforce (same names as MFOS) and the
 * project's existing Supabase vars. When SUPABASE_SERVICE_ROLE_KEY is configured
 * the write runs with it; otherwise it runs as the calling admin (RLS enforced).
 */
import { createClient } from '@supabase/supabase-js'
import {
  readSalesforceEnv,
  getAccessToken,
  describeObject,
  queryAll,
} from './_shared/salesforceClient.js'
import { resolveAccountFields, deriveArea } from './_shared/dealerAreas.js'
import { getSupabaseAdmin } from './_shared/supabaseAdmin.js'
import { getSupabaseUrl, getSupabaseAnonKey } from './_shared/supabaseEnv.js'
import { bearerFrom, getUserFromJwt, json } from './_shared/auth.js'

export const config = { path: '/api/salesforce-dealers-sync' }

const TABLE = 'dealer_directory'

function text(v) {
  const s = v == null ? '' : String(v).trim()
  return s || null
}

/**
 * Resolve the Supabase client used for the WRITE. Prefer the service role (when
 * present); otherwise fall back to the calling admin's JWT so no new env var is
 * required. Returns { client, error }.
 */
async function resolveWriteClient(jwt) {
  const admin = getSupabaseAdmin()
  if (admin) return { client: admin, error: '' }

  const url = getSupabaseUrl()
  const anon = getSupabaseAnonKey()
  if (!url || !anon) return { client: null, error: 'Supabase env is not configured.' }
  if (!jwt) return { client: null, error: 'Sign in as an Arrowquip admin to sync.' }

  const { user, error } = await getUserFromJwt(jwt)
  if (!user) return { client: null, error: error || 'Invalid session.' }
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { client, error: '' }
}

async function upsertChunks(client, rows, onConflict) {
  const chunk = 150
  let n = 0
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    const { error } = await client.from(TABLE).upsert(slice, { onConflict })
    if (error) throw new Error(error.message)
    n += slice.length
  }
  return n
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const jwt = bearerFrom(req)
  const { client, error: clientError } = await resolveWriteClient(jwt)
  if (!client) return json({ ok: false, error: clientError }, 401)

  const env = readSalesforceEnv()
  if (env.missing.length) {
    return json({ ok: false, error: `Missing env: ${env.missing.join(', ')}` }, 500)
  }

  const syncedAt = new Date().toISOString()

  try {
    const { accessToken, instanceUrl } = await getAccessToken(env)

    // 1) Resolve org-specific Account field API names (read-only describe).
    const describe = await describeObject({
      instanceUrl,
      accessToken,
      apiVersion: env.apiVersion,
      objectName: 'Account',
    })
    const resolved = resolveAccountFields(describe)

    // 2) Build a SELECT of standard + resolved fields.
    const selectCols = ['Id', 'Name', 'BillingCity', 'BillingState', 'BillingCountry', 'Owner.Name']
    const dynamic = {}
    for (const [key, apiName] of Object.entries(resolved)) {
      if (apiName && !selectCols.includes(apiName)) {
        selectCols.push(apiName)
        dynamic[key] = apiName
      }
    }

    // 3) Read-only fetch of EVERY Account (all areas — no owner filter).
    const { records } = await queryAll({
      instanceUrl,
      accessToken,
      apiVersion: env.apiVersion,
      soql: `SELECT ${selectCols.join(', ')} FROM Account ORDER BY Name`,
    })

    const val = (r, apiName) => (apiName ? r?.[apiName] : null)
    const dealers = records
      .map((r) => {
        const id = String(r?.Id || '').trim()
        if (!id) return null
        const team = text(val(r, resolved.team))
        const territory = text(val(r, resolved.territory))
        const territoryManager = text(val(r, resolved.territoryManager))
        const billingCountry = text(r?.BillingCountry)
        return {
          salesforce_account_id: id,
          dealer_name: String(r?.Name || '').trim(),
          team,
          account_owner: text(r?.Owner?.Name),
          territory_manager: territoryManager,
          dealer_success_specialist: text(val(r, resolved.dealerSuccessSpecialist)),
          billing_city: text(r?.BillingCity),
          billing_state: text(r?.BillingState),
          billing_country: billingCountry,
          status: text(val(r, resolved.status)),
          area: deriveArea({ team, territory, territoryManager, billingCountry }),
        }
      })
      .filter(Boolean)

    // 4) Settings-preserving upsert (Salesforce-sourced columns only).
    const rows = dealers.map((d) => ({ ...d, sf_present: true, source_missing_at: null, last_synced_at: syncedAt }))
    const upserted = rows.length ? await upsertChunks(client, rows, 'salesforce_account_id') : 0

    // 5) Flag rows no longer returned by Salesforce (never delete them).
    const presentIds = dealers.map((d) => d.salesforce_account_id)
    let markedMissing = 0
    {
      let q = client.from(TABLE).update({ sf_present: false, source_missing_at: syncedAt }).eq('sf_present', true)
      if (presentIds.length) {
        q = q.not('salesforce_account_id', 'in', `(${presentIds.map((id) => `"${id}"`).join(',')})`)
      }
      const { data, error } = await q.select('id')
      if (error) throw new Error(error.message)
      markedMissing = Array.isArray(data) ? data.length : 0
    }

    return json({ ok: true, remoteCount: dealers.length, upserted, markedMissing, resolvedFields: dynamic, syncedAt })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Salesforce sync failed'
    return json({ ok: false, error: message }, e?.isAuthError ? 401 : 502)
  }
}
