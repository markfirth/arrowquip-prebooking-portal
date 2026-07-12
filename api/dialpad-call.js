/**
 * Vercel API route — POST /api/dialpad-call?k=<TOKEN>
 * Body: { number: string, dealerId?: string, visitId?: string }
 *
 * Places an outbound call through Dialpad so the rep's "Call Dealer" button
 * rings their configured Dialpad device and then dials the dealer — never SMS,
 * never Google Voice, never the wrong app. Dialpad credentials stay server-side.
 *
 * Env:
 *   DIALPAD_API_KEY   — Dialpad API token (required)
 *   DIALPAD_USER_ID   — the calling user's Dialpad user id (required)
 *   DIALPAD_DEVICE    — optional: 'native' | 'cell' | ... (Dialpad "outbound_caller"/device hint)
 *
 * Without the env the endpoint answers { ok:false, reason:'not_configured' }
 * so the frontend can show a clear error and fall back — a call is never faked.
 */
const { ACCESS_TOKEN } = require('./_lib/dealerService')

/* best-effort E.164: keep a leading +, strip non-digits, default NANP (+1) for 10-digit */
function toE164(raw) {
  let s = String(raw || '').trim()
  if (!s) return ''
  const plus = s[0] === '+'
  const digits = s.replace(/[^\d]/g, '')
  if (!digits) return ''
  if (plus) return '+' + digits
  if (digits.length === 10) return '+1' + digits
  if (digits.length === 11 && digits[0] === '1') return '+' + digits
  return '+' + digits
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method' }); return }
  if (((req.query && req.query.k) || '') !== ACCESS_TOKEN) { res.status(404).json({ ok: false }); return }

  const key = String(process.env.DIALPAD_API_KEY || '').trim()
  const userId = String(process.env.DIALPAD_USER_ID || '').trim()
  if (!key || !userId) {
    res.status(200).json({ ok: false, reason: 'not_configured',
      message: 'Dialpad calling requires DIALPAD_API_KEY and DIALPAD_USER_ID in the Vercel environment.' })
    return
  }

  const body = req.body || {}
  const number = toE164(body.number)
  if (!number) { res.status(200).json({ ok: false, reason: 'bad_number' }); return }

  try {
    const payload = { phone_number: number, user_id: userId, group_id: null, custom_data:
      JSON.stringify({ dealerId: body.dealerId || '', visitId: body.visitId || '' }) }
    const device = String(process.env.DIALPAD_DEVICE || '').trim()
    if (device) payload.device_id = device

    const resp = await fetch('https://dialpad.com/api/v2/call', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await resp.json().catch(() => null)
    if (!resp.ok) {
      res.status(200).json({ ok: false, reason: 'api_error',
        message: (data && (data.error || data.message)) || ('status ' + resp.status) })
      return
    }
    res.status(200).json({ ok: true, number, callId: (data && (data.call_id || data.id)) || null })
  } catch (e) {
    res.status(200).json({ ok: false, reason: 'error', message: (e && e.message) || String(e) })
  }
}
