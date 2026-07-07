/**
 * Netlify Function — GET /api/salesforce-dealers?k=<TOKEN>[&refresh=1]
 * Thin wrapper over the shared Dealer Service (api/_lib/dealerService.js), so the
 * Salesforce logic lives in exactly one place across Vercel and Netlify.
 * Preserves the existing contract: { ok, count, dealers }.
 */
import dealerService from '../../api/_lib/dealerService.js'

export const config = { path: '/api/salesforce-dealers' }

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export default async function handler(req) {
  const url = new URL(req.url)
  if (url.searchParams.get('k') !== dealerService.ACCESS_TOKEN) return json({ ok: false, error: 'Not found' }, 404)
  try {
    const refresh = url.searchParams.get('refresh') === '1'
    const { dealers, meta } = await dealerService.getDealers({ refresh })
    return json({ ok: true, count: dealers.length, dealers, meta })
  } catch (e) {
    return json({ ok: false, error: (e && e.message) || String(e), dealers: [] }, 502)
  }
}
