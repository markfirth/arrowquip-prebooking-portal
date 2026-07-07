/**
 * Netlify Function — POST /api/salesforce-refresh?k=<TOKEN>
 * Manual "Refresh Salesforce" — forces a re-read and repopulates the cache.
 * Read-only; gated. Delegates to the shared Dealer Service.
 */
import dealerService from '../../api/_lib/dealerService.js'

export const config = { path: '/api/salesforce-refresh' }

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export default async function handler(req) {
  const url = new URL(req.url)
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)
  if (url.searchParams.get('k') !== dealerService.ACCESS_TOKEN) return json({ ok: false, error: 'Not found' }, 404)
  try {
    const { dealers, meta } = await dealerService.getDealers({ refresh: true })
    return json({ ok: true, count: dealers.length, meta })
  } catch (e) {
    return json({ ok: false, error: (e && e.message) || String(e) }, 502)
  }
}
