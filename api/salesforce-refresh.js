/**
 * Vercel API route — POST /api/salesforce-refresh  (Authorization: Bearer <Supabase session>)
 * Manual "Refresh Salesforce" — forces the Dealer Service to re-read Salesforce
 * and repopulate the cache, bypassing the TTL. Read-only; gated.
 */
const { getDealers, auditSync } = require('./_lib/dealerService')
const { requireApprovedUser } = require('./_lib/auth')

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return }
  if (!(await requireApprovedUser(req, res))) return
  try {
    const { dealers, meta } = await getDealers({ refresh: true })
    // Post-sync validation: Record Type + coordinates + ownership, all read-only.
    // Best-effort — a validation error never fails the sync itself.
    let audit = null
    try { audit = await auditSync() } catch (e) { audit = { error: (e && e.message) || String(e) } }
    res.status(200).json({ ok: true, count: dealers.length, meta, audit })
  } catch (e) {
    res.status(502).json({ ok: false, error: e && e.message ? e.message : String(e) })
  }
}
