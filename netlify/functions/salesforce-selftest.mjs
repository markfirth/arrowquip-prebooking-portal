/**
 * Salesforce connection self-test — READ-ONLY, no secrets ever returned.
 * GET /api/salesforce-selftest
 *
 * Runs the three pre-build verification checks, using ONLY the Netlify env vars
 * that MFOS already uses (SALESFORCE_INSTANCE_URL / _CLIENT_ID / _CLIENT_SECRET /
 * _API_VERSION) plus the project's existing Supabase vars. It does not require
 * SALESFORCE_OWNER_ID and never filters by owner.
 *
 *   1. env       — which required vars are present (booleans only, no values).
 *   2. auth      — whether the Salesforce client-credentials flow succeeds.
 *   3. testQuery — a LIMIT 5 SELECT across ALL Accounts (every area) + resolved
 *                  field API names and a few dealer names as proof.
 *
 * Nothing is written to Salesforce or Supabase.
 */
import {
  readSalesforceEnv,
  getAccessToken,
  describeObject,
  runQuery,
} from './_shared/salesforceClient.js'
import { resolveAccountFields } from './_shared/dealerAreas.js'
import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceRoleKey } from './_shared/supabaseEnv.js'
import { json } from './_shared/auth.js'

export const config = { path: '/api/salesforce-selftest' }

export default async function handler() {
  const env = readSalesforceEnv()
  const checks = {
    env: {
      SALESFORCE_INSTANCE_URL: !!env.instanceUrl,
      SALESFORCE_CLIENT_ID: !!env.clientId,
      SALESFORCE_CLIENT_SECRET: !!env.clientSecret,
      SALESFORCE_API_VERSION: env.apiVersion,
      // Existing Supabase vars (presence only).
      SUPABASE_URL: !!getSupabaseUrl(),
      SUPABASE_ANON_OR_PUBLISHABLE_KEY: !!getSupabaseAnonKey(),
      SUPABASE_SERVICE_ROLE_KEY: !!getSupabaseServiceRoleKey(),
    },
    auth: { ok: false, error: '' },
    testQuery: { ok: false, error: '', totalSize: 0, sampleNames: [], resolvedFields: {} },
  }

  if (env.missing.length) {
    return json(
      { ok: false, stage: 'env', error: `Missing env: ${env.missing.join(', ')}`, checks },
      500,
    )
  }

  // Check 2 — Salesforce authentication.
  let accessToken
  let activeInstanceUrl
  try {
    const tok = await getAccessToken(env)
    accessToken = tok.accessToken
    activeInstanceUrl = tok.instanceUrl
    checks.auth.ok = true
  } catch (e) {
    checks.auth.error = e instanceof Error ? e.message : String(e)
    return json({ ok: false, stage: 'auth', error: checks.auth.error, checks }, 502)
  }

  // Check 3 — read-only test query across ALL Accounts (no owner filter).
  try {
    const describe = await describeObject({
      instanceUrl: activeInstanceUrl,
      accessToken,
      apiVersion: env.apiVersion,
      objectName: 'Account',
    })
    const resolved = resolveAccountFields(describe)
    checks.testQuery.resolvedFields = resolved

    const cols = ['Id', 'Name', 'BillingState', 'BillingCountry', 'Owner.Name']
    for (const apiName of Object.values(resolved)) {
      if (apiName && !cols.includes(apiName)) cols.push(apiName)
    }
    const page = await runQuery({
      instanceUrl: activeInstanceUrl,
      accessToken,
      apiVersion: env.apiVersion,
      soql: `SELECT ${cols.join(', ')} FROM Account ORDER BY Name LIMIT 5`,
    })
    checks.testQuery.ok = true
    checks.testQuery.totalSize = Number(page?.totalSize ?? (page?.records?.length || 0))
    checks.testQuery.sampleNames = (page?.records || []).map((r) => r?.Name).filter(Boolean)
  } catch (e) {
    checks.testQuery.error = e instanceof Error ? e.message : String(e)
    return json({ ok: false, stage: 'testQuery', error: checks.testQuery.error, checks }, 502)
  }

  return json({ ok: true, message: 'All three checks passed.', checks })
}
