/**
 * POST /api/ready-to-book-email
 * Authorization: Bearer <Supabase session>
 *
 * Notifies the assigned sales assistant (Travel Coordinator) that a trip
 * is Ready to Book. Never claims success without a real transport result.
 * Dedupes via idempotencyKey when the client retries.
 */
const { requireApprovedUser } = require('./_lib/auth')
const { emailSendEnabled, emailAllowlist, testRecipient } = require('./_lib/fieldOpsSafety')

const _sentKeys = new Map()

function pruneKeys() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  for (const [k, v] of _sentKeys.entries()) {
    if (!v || v.at < cutoff) _sentKeys.delete(k)
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method', sent: false }); return }
  const user = await requireApprovedUser(req, res)
  if (!user) return

  const body = req.body || {}
  const to = String(body.to || '').trim().toLowerCase()
  const subject = String(body.subject || '').slice(0, 220)
  const text = String(body.text || '').slice(0, 20000)
  const html = String(body.html || '').slice(0, 40000)
  const idem = String(body.idempotencyKey || body.tripKey || '').slice(0, 200)

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    res.status(200).json({ ok: false, reason: 'bad_recipient', message: 'Sales assistant email is missing or invalid.', sent: false })
    return
  }

  pruneKeys()
  if (idem && _sentKeys.has(idem)) {
    const prev = _sentKeys.get(idem)
    res.status(200).json({
      ok: true,
      mode: 'deduped',
      sent: !!prev.sent,
      id: prev.id || null,
      message: 'Duplicate notification suppressed — already delivered for this submission.',
      to,
    })
    return
  }

  if (!emailSendEnabled()) {
    res.status(200).json({
      ok: true,
      mode: 'dry_run',
      sent: false,
      to,
      message: 'Email sending disabled. Trip was saved; configure FIELD_OPS_EMAIL_SEND_ENABLED + transport to deliver Ready to Book mail.',
      fromUser: user.email || user.id,
    })
    return
  }

  const allow = new Set(emailAllowlist())
  const test = testRecipient()
  if (!(allow.has(to) || (test && to === test))) {
    res.status(200).json({
      ok: false,
      reason: 'not_allowlisted',
      message: 'Sales assistant email is not on FIELD_OPS_EMAIL_ALLOWLIST. Trip saved; notification not sent.',
      sent: false,
      to,
    })
    return
  }

  const graphConfigured = !!(process.env.MS_GRAPH_CLIENT_ID && process.env.MS_GRAPH_CLIENT_SECRET && process.env.MS_GRAPH_TENANT_ID)
  const resendKey = String(process.env.RESEND_API_KEY || '').trim()

  if (!graphConfigured && !resendKey) {
    res.status(200).json({
      ok: false,
      reason: 'not_configured',
      message: 'No approved email transport configured (Microsoft Graph or Resend). Trip saved; nothing was sent.',
      sent: false,
      to,
    })
    return
  }

  if (resendKey) {
    try {
      const from = String(process.env.FIELD_OPS_EMAIL_FROM || process.env.READY_TO_BOOK_EMAIL_FROM || 'Arrowquip TRAVEL <onboarding@resend.dev>')
      const payload = {
        from,
        to: [to],
        subject: subject || 'Arrowquip TRAVEL | Ready to Book',
        text: text || '(empty body)',
      }
      if (html) payload.html = html
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        res.status(200).json({ ok: false, reason: 'transport_error', message: data.message || ('status ' + resp.status), sent: false, to })
        return
      }
      const id = data.id || null
      if (idem) _sentKeys.set(idem, { at: Date.now(), sent: true, id })
      res.status(200).json({ ok: true, mode: 'sent', provider: 'resend', id, to, sent: true })
      return
    } catch (e) {
      res.status(200).json({ ok: false, reason: 'transport_error', message: String(e && e.message || e), sent: false, to })
      return
    }
  }

  res.status(200).json({
    ok: false,
    reason: 'graph_not_implemented',
    message: 'Microsoft Graph transport is reserved for IT-approved rollout.',
    sent: false,
    to,
  })
}
