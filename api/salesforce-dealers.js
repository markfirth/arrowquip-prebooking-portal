/**
 * Vercel API route — GET /api/salesforce-dealers?k=<TOKEN>[&refresh=1]
 * Thin wrapper over the shared Dealer Service (the only Salesforce caller).
 * Preserves the existing contract: { ok, count, dealers }.
 */
const { getDealers, ACCESS_TOKEN } = require('./_lib/dealerService')

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const k = (req.query && req.query.k) || ''
  if (k !== ACCESS_TOKEN) { res.status(404).json({ ok: false, error: 'Not found' }); return }
  try {
    const refresh = String((req.query && req.query.refresh) || '') === '1'
    const { dealers, meta } = await getDealers({ refresh })
    res.status(200).json({ ok: true, count: dealers.length, dealers, meta })
  } catch (e) {
    // No cache and Salesforce unavailable → frontend keeps its seed fallback.
    res.status(502).json({ ok: false, error: e && e.message ? e.message : String(e), dealers: [] })
  }
}
