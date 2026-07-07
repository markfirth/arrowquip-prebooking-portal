/**
 * Vercel API route — POST /api/salesforce-refresh?k=<TOKEN>
 * Manual "Refresh Salesforce" — forces the Dealer Service to re-read Salesforce
 * and repopulate the cache, bypassing the TTL. Read-only; gated.
 */
const { getDealers, ACCESS_TOKEN } = require('./_lib/dealerService')

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return }
  const k = (req.query && req.query.k) || ''
  if (k !== ACCESS_TOKEN) { res.status(404).json({ ok: false, error: 'Not found' }); return }
  try {
    const { dealers, meta } = await getDealers({ refresh: true })
    res.status(200).json({ ok: true, count: dealers.length, meta })
  } catch (e) {
    res.status(502).json({ ok: false, error: e && e.message ? e.message : String(e) })
  }
}
