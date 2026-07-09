/**
 * Vercel API route — POST /api/receipt-ocr?k=<TOKEN>
 * Body: { image: <base64 JPEG>, mime: 'image/jpeg' }
 *
 * Reads a receipt image with the Claude API and returns structured fields:
 *   { ok, vendor, date, total, tax, currency, category, confidence }
 *
 * Requires ANTHROPIC_API_KEY in the Vercel environment. Without it this
 * endpoint answers { ok:false, reason:'not_configured' } — the app then files
 * the receipt as "Needs Review" instead of pretending to read it.
 */
const { ACCESS_TOKEN } = require('./_lib/dealerService')

const CATEGORIES = ['Flights', 'Hotels', 'Food', 'Fuel', 'Rental Cars', 'Parking / Tolls', 'Other']

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method' }); return }
  const k = (req.query && req.query.k) || ''
  if (k !== ACCESS_TOKEN) { res.status(404).json({ ok: false, error: 'Not found' }); return }

  const key = String(process.env.ANTHROPIC_API_KEY || '').trim()
  if (!key) {
    res.status(200).json({ ok: false, reason: 'not_configured',
      message: 'AI receipt reading requires ANTHROPIC_API_KEY in the Vercel environment.' })
    return
  }

  const body = req.body || {}
  const image = String(body.image || '')
  const mime = String(body.mime || 'image/jpeg')
  if (!image || image.length > 8_000_000) { res.status(200).json({ ok: false, reason: 'bad_image' }); return }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: image } },
            { type: 'text', text:
              'This is a photo of an expense receipt from a business road trip. ' +
              'Extract the fields and respond with ONLY a JSON object, no prose, no code fences: ' +
              '{"vendor":string,"date":"YYYY-MM-DD"|null,"total":number|null,"tax":number|null,' +
              '"currency":"USD"|"CAD"|string|null,"category":one of ' + JSON.stringify(CATEGORIES) + ',' +
              '"confidence":number between 0 and 1 reflecting how legible/complete the receipt is}. ' +
              'total is the final amount paid. If a field is unreadable use null and lower confidence.' },
          ],
        }],
      }),
    })
    const data = await resp.json().catch(() => null)
    if (!resp.ok || !data || !Array.isArray(data.content)) {
      res.status(200).json({ ok: false, reason: 'api_error', message: (data && data.error && data.error.message) || `status ${resp.status}` })
      return
    }
    const text = (data.content.find((c) => c.type === 'text') || {}).text || ''
    const m = text.match(/\{[\s\S]*\}/)
    const parsed = m ? JSON.parse(m[0]) : null
    if (!parsed) { res.status(200).json({ ok: false, reason: 'parse_error' }); return }
    res.status(200).json({
      ok: true,
      vendor: parsed.vendor || null,
      date: parsed.date || null,
      total: Number.isFinite(+parsed.total) ? +parsed.total : null,
      tax: Number.isFinite(+parsed.tax) ? +parsed.tax : null,
      currency: parsed.currency || null,
      category: CATEGORIES.includes(parsed.category) ? parsed.category : 'Other',
      confidence: Math.max(0, Math.min(1, +parsed.confidence || 0)),
    })
  } catch (e) {
    res.status(200).json({ ok: false, reason: 'error', message: (e && e.message) || String(e) })
  }
}
