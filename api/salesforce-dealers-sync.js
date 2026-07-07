/**
 * Sync every Salesforce Account into the Pre-Booking Portal Dealer Directory.
 * POST /api/salesforce-dealers-sync
 *   Auth: Authorization: Bearer <supabase JWT>  OR  x-sync-secret: <PREBOOK_SYNC_SECRET>
 *
 * READ-ONLY against Salesforce: authenticates, describes the Account object to
 * resolve field API names, then SELECTs Accounts across EVERY area/territory
 * (no OwnerId filter). It never creates, updates, or deletes Salesforce data.
 *
 * Into Supabase it performs a settings-preserving upsert keyed on
 * salesforce_account_id (so there are never duplicate dealer rows): only the
 * Salesforce-sourced columns are written. Local admin + planner columns
 * (visible_in_portal, show_in_area_tabs, area_override, planner_data, notes) are
 * omitted from the payload, so they are preserved across syncs. Accounts that
 * stop appearing in Salesforce are flagged sf_present=false (never deleted).
 */
import { authorizeSync } from './_lib/httpAuth.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import {
  readSalesforceEnv,
  getAccessToken,
  describeObject,
  queryAll,
} from './_lib/salesforceClient.js'
import { resolveAccountFields, deriveArea } from './_lib/dealerAreas.js'

const TABLE = 'dealer_directory'

async function upsertChunks(admin, rows, onConflict) {
  const chunk = 150
  let n = 0
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    const { error } = await admin.from(TABLE).upsert(slice, { onConflict })
    if (error) throw new Error(error.message)
    n += slice.length
  }
  return n
}

function text(v) {
  const s = v == null ? '' : String(v).trim()
  return s || null
}

export default async function salesforceDealersSync(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const auth = await authorizeSync(req)
  if (!auth.ok) {
    res.status(401).json({ ok: false, error: auth.error || 'Sign in required.' })
    return
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    res.status(503).json({ ok: false, error: 'Supabase service role is not configured.' })
    return
  }

  const { instanceUrl, clientId, clientSecret, apiVersion, missing } = readSalesforceEnv()
  if (missing.length) {
    res.status(500).json({ ok: false, error: `Missing required environment variable(s): ${missing.join(', ')}` })
    return
  }

  const syncedAt = new Date().toISOString()

  try {
    const { accessToken, instanceUrl: activeInstanceUrl } = await getAccessToken({
      instanceUrl,
      clientId,
      clientSecret,
    })

    // 1) Resolve the org-specific Account field API names (read-only describe).
    const describe = await describeObject({
      instanceUrl: activeInstanceUrl,
      accessToken,
      apiVersion,
      objectName: 'Account',
    })
    const resolved = resolveAccountFields(describe)

    // 2) Build a SELECT of standard + resolved fields, de-duplicated.
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
      instanceUrl: activeInstanceUrl,
      accessToken,
      apiVersion,
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

    // 4) Settings-preserving upsert (Salesforce-sourced columns only). Local
    //    admin + planner columns are omitted, so on conflict they are untouched.
    const rows = dealers.map((d) => ({ ...d, sf_present: true, source_missing_at: null, last_synced_at: syncedAt }))
    const upserted = rows.length ? await upsertChunks(admin, rows, 'salesforce_account_id') : 0

    // 5) Flag rows no longer returned by Salesforce (never delete them).
    const presentIds = dealers.map((d) => d.salesforce_account_id)
    let markedMissing = 0
    {
      let q = admin
        .from(TABLE)
        .update({ sf_present: false, source_missing_at: syncedAt })
        .eq('sf_present', true)
      if (presentIds.length) {
        q = q.not('salesforce_account_id', 'in', `(${presentIds.map((id) => `"${id}"`).join(',')})`)
      }
      const { data, error } = await q.select('id')
      if (error) throw new Error(error.message)
      markedMissing = Array.isArray(data) ? data.length : 0
    }

    res.status(200).json({
      ok: true,
      remoteCount: dealers.length,
      upserted,
      markedMissing,
      resolvedFields: dynamic,
      syncedAt,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Salesforce sync failed'
    res.status(e?.isAuthError ? 401 : 502).json({ ok: false, error: message })
  }
}
