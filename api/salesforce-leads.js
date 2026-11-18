/**
 * Vercel API route — GET /api/salesforce-leads?q=…  (Authorization: Bearer <session>)
 * Read-only Salesforce Lead search for Cindel’s new-dealer pipeline.
 */
const { searchLeads } = require('./_lib/dealerService')
const { requireApprovedUser } = require('./_lib/auth')

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (!(await requireApprovedUser(req, res))) return
  try {
    const q = String((req.query && req.query.q) || '')
    const limit = parseInt((req.query && req.query.limit) || '25', 10)
    const { leads, meta } = await searchLeads({ q, limit })
    res.status(200).json({ ok: true, count: leads.length, leads, meta })
  } catch (e) {
    res.status(502).json({
      ok: false,
      error: e && e.message ? e.message : String(e),
      leads: [],
    })
  }
}
