/**
 * Hard guards for Phase 2/3 field-ops features.
 * Preview / test mode must never email leadership or invent successful delivery.
 */

function envFlag(name) {
  const v = String(process.env[name] || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

/** Emails may only leave the system when explicitly enabled. */
function emailSendEnabled() {
  return envFlag('FIELD_OPS_EMAIL_SEND_ENABLED')
}

/** Comma-separated allowlist. Empty = deny all. */
function emailAllowlist() {
  return String(process.env.FIELD_OPS_EMAIL_ALLOWLIST || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function testRecipient() {
  return String(process.env.FIELD_OPS_TEST_EMAIL || '').trim().toLowerCase()
}

/**
 * Filter requested recipients. In default (safe) mode only the configured
 * test recipient may remain. Leadership addresses are stripped unless the
 * allowlist explicitly includes them AND send is enabled.
 */
function filterRecipients(requested) {
  const req = (Array.isArray(requested) ? requested : [])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean)
  const allow = new Set(emailAllowlist())
  const test = testRecipient()
  const sendOn = emailSendEnabled()

  if (!sendOn) {
    return {
      ok: false,
      reason: 'send_disabled',
      message: 'Email sending is disabled. Set FIELD_OPS_EMAIL_SEND_ENABLED=true and an allowlist for controlled tests only.',
      wouldSend: [],
      blocked: req,
    }
  }

  const allowed = []
  const blocked = []
  req.forEach((e) => {
    if (allow.has(e) || (test && e === test)) allowed.push(e)
    else blocked.push(e)
  })

  // If nothing requested, fall back to test recipient only
  if (!allowed.length && test && allow.has(test)) allowed.push(test)

  if (!allowed.length) {
    return {
      ok: false,
      reason: 'no_allowed_recipients',
      message: 'No requested recipients are on FIELD_OPS_EMAIL_ALLOWLIST. Refusing to send.',
      wouldSend: [],
      blocked: req,
    }
  }

  return { ok: true, wouldSend: allowed, blocked }
}

module.exports = {
  emailSendEnabled,
  emailAllowlist,
  testRecipient,
  filterRecipients,
  envFlag,
}
