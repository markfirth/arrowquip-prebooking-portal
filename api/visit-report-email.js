/**
 * POST /api/visit-report-email
 * Authorization: Bearer <Supabase session>
 *
 * Distributes the approved personal task email and/or executive PDF.
 * HARD DEFAULT: sending is OFF. Only allowlisted / test recipients may receive
 * mail when FIELD_OPS_EMAIL_SEND_ENABLED=true. Never claims success when
 * credentials are missing. Never emails dealers by default.
 */
const { requireApprovedUser } = require('./_lib/auth')
const { filterRecipients, testRecipient, emailSendEnabled } = require('./_lib/fieldOpsSafety')

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method' }); return }
  const user = await requireApprovedUser(req, res)
  if (!user) return

  const body = req.body || {}
  const kind = String(body.kind || 'executive') // 'personal' | 'executive'
  const subject = String(body.subject || '').slice(0, 200)
  const text = String(body.text || body.htmlText || '').slice(0, 20000)
  const recipients = body.recipients || []
  const dryRun = body.dryRun === true || body.preview === true

  const filtered = filterRecipients(recipients)
  if (dryRun || !emailSendEnabled()) {
    res.status(200).json({
      ok: true,
      mode: 'dry_run',
      kind,
      subject,
      fromUser: user.email || user.id,
      filter: filtered,
      testRecipient: testRecipient() || null,
      message: emailSendEnabled()
        ? 'Dry-run only — no email was sent.'
        : 'Email sending disabled. Configure FIELD_OPS_EMAIL_SEND_ENABLED + allowlist for controlled tests. No message was sent.',
      sent: false,
    })
    return
  }

  if (!filtered.ok) {
    res.status(200).json({ ok: false, reason: filtered.reason, message: filtered.message, filter: filtered, sent: false })
    return
  }

  // Transport not wired yet (Graph / M365). Refuse rather than fake delivery.
  const graphConfigured = !!(process.env.MS_GRAPH_CLIENT_ID && process.env.MS_GRAPH_CLIENT_SECRET && process.env.MS_GRAPH_TENANT_ID)
  const resendKey = String(process.env.RESEND_API_KEY || '').trim()

  if (!graphConfigured && !resendKey) {
    res.status(200).json({
      ok: false,
      reason: 'not_configured',
      message: 'No approved email transport configured (Microsoft Graph or Resend). Report and tasks are retained; nothing was sent.',
      filter: filtered,
      sent: false,
    })
    return
  }

  // Resend path for controlled tests only
  if (resendKey) {
    try {
      const from = String(process.env.FIELD_OPS_EMAIL_FROM || 'Arrowquip TRAVEL <onboarding@resend.dev>')
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: filtered.wouldSend,
          subject: subject || 'Arrowquip Dealer Visit',
          text: text || '(empty body)',
        }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        res.status(200).json({ ok: false, reason: 'transport_error', message: data.message || ('status ' + resp.status), sent: false, filter: filtered })
        return
      }
      res.status(200).json({ ok: true, mode: 'sent_test', provider: 'resend', id: data.id || null, to: filtered.wouldSend, blocked: filtered.blocked, sent: true })
      return
    } catch (e) {
      res.status(200).json({ ok: false, reason: 'transport_error', message: String(e && e.message || e), sent: false })
      return
    }
  }

  res.status(200).json({
    ok: false,
    reason: 'graph_not_implemented',
    message: 'Microsoft Graph transport is reserved for IT-approved rollout. Use Resend test keys for controlled previews only.',
    filter: filtered,
    sent: false,
  })
}
