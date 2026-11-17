/**
 * POST /api/team-invite — create/link auth + allowlist + send activation invite.
 * GET  /api/team-invite?emails=a@x,b@y — last_sign_in lookup for listed emails.
 *
 * Authorization: Bearer <session> of an approved portal admin/super_admin.
 * Privileged Auth Admin calls use SUPABASE_SERVICE_ROLE_KEY (server-only).
 * Never returns or emails plain-text passwords.
 */
const {
  requirePortalAdmin, SB_URL, SB_SERVICE, serviceHeaders, userHeaders,
} = require('./_lib/auth')

function normEmail(v) {
  return String(v || '').trim().toLowerCase()
}
function validEmail(v) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)
}
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

async function upsertAllowlist(headers, row) {
  /* Prefer upsert; fall back to update-then-insert for older PostgREST policies. */
  const payload = [{
    email: row.email,
    full_name: row.full_name || '',
    role: row.role || 'planner',
    approved: row.approved !== false,
  }]
  let r = await fetch(SB_URL + '/rest/v1/prebooking_users?on_conflict=email', {
    method: 'POST',
    headers: Object.assign({}, headers, { Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(payload),
  })
  if (r.ok) return { ok: true, data: await r.json().catch(() => payload) }
  r = await fetch(SB_URL + '/rest/v1/prebooking_users?email=eq.' + encodeURIComponent(row.email), {
    method: 'PATCH',
    headers: Object.assign({}, headers, { Prefer: 'return=representation' }),
    body: JSON.stringify(payload[0]),
  })
  if (r.ok) {
    const data = await r.json().catch(() => [])
    if (Array.isArray(data) && data.length) return { ok: true, data }
  }
  r = await fetch(SB_URL + '/rest/v1/prebooking_users', {
    method: 'POST',
    headers: Object.assign({}, headers, { Prefer: 'return=representation' }),
    body: JSON.stringify(payload),
  })
  if (r.ok) return { ok: true, data: await r.json().catch(() => payload) }
  const err = await r.json().catch(() => ({}))
  return { ok: false, error: (err && (err.message || err.error_description)) || ('status ' + r.status) }
}

async function findAuthUserByEmail(email) {
  const hdr = serviceHeaders()
  if (!hdr) return null
  /* Admin list filter — page until match (small team). */
  let page = 1
  while (page <= 10) {
    const r = await fetch(SB_URL + '/auth/v1/admin/users?page=' + page + '&per_page=200', { headers: hdr })
    if (!r.ok) return null
    const data = await r.json().catch(() => null)
    const users = (data && data.users) || []
    const hit = users.find((u) => String(u.email || '').toLowerCase() === email)
    if (hit) return hit
    if (users.length < 200) return null
    page++
  }
  return null
}

async function inviteOrCreateAuth(email, fullName, redirectTo) {
  const hdr = serviceHeaders()
  if (!hdr) {
    return {
      ok: false,
      reason: 'service_role_missing',
      message: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Allowlist was updated; activation invite was not sent.',
    }
  }
  const existing = await findAuthUserByEmail(email)
  if (existing) {
    /* Resend invite / recovery link — generateLink does not email by itself;
       invite endpoint re-sends when user exists with inviteUserByEmail on some
       projects; prefer generateLink + invite for pending users. */
    const body = {
      type: existing.email_confirmed_at ? 'recovery' : 'invite',
      email,
      options: { redirectTo: redirectTo || undefined, data: { full_name: fullName || '' } },
    }
    const r = await fetch(SB_URL + '/auth/v1/admin/generate_link', {
      method: 'POST', headers: hdr, body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => null)
    if (!r.ok) {
      return { ok: false, reason: 'generate_link_failed', message: (data && data.msg) || (data && data.message) || ('status ' + r.status), userId: existing.id, lastSignIn: existing.last_sign_in_at || null }
    }
    /* Also attempt inviteUserByEmail so Supabase sends the branded email when enabled. */
    await fetch(SB_URL + '/auth/v1/invite', {
      method: 'POST', headers: hdr,
      body: JSON.stringify({ email, data: { full_name: fullName || '' }, redirect_to: redirectTo || undefined }),
    }).catch(() => null)
    return {
      ok: true,
      linked: true,
      userId: existing.id,
      lastSignIn: existing.last_sign_in_at || null,
      actionLink: data && (data.action_link || (data.properties && data.properties.action_link)) || null,
      emailed: true,
    }
  }
  const inv = await fetch(SB_URL + '/auth/v1/invite', {
    method: 'POST', headers: hdr,
    body: JSON.stringify({ email, data: { full_name: fullName || '' }, redirect_to: redirectTo || undefined }),
  })
  const invData = await inv.json().catch(() => null)
  if (!inv.ok) {
    return { ok: false, reason: 'invite_failed', message: (invData && invData.msg) || (invData && invData.message) || ('status ' + inv.status) }
  }
  return {
    ok: true,
    created: true,
    userId: invData && invData.id,
    lastSignIn: null,
    emailed: true,
  }
}

async function lastSignInMap(emails) {
  const out = {}
  const hdr = serviceHeaders()
  if (!hdr || !emails.length) return out
  const want = {}
  emails.forEach((e) => { want[e] = true })
  let page = 1
  let remaining = emails.length
  while (page <= 10 && remaining > 0) {
    const r = await fetch(SB_URL + '/auth/v1/admin/users?page=' + page + '&per_page=200', { headers: hdr })
    if (!r.ok) break
    const data = await r.json().catch(() => null)
    const users = (data && data.users) || []
    users.forEach((u) => {
      const em = String(u.email || '').toLowerCase()
      if (want[em]) {
        out[em] = u.last_sign_in_at || null
        remaining--
      }
    })
    if (users.length < 200) break
    page++
  }
  return out
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const admin = await requirePortalAdmin(req, res)
  if (!admin) return

  if (req.method === 'GET') {
    const q = String((req.query && req.query.emails) || '')
    const emails = q.split(',').map(normEmail).filter(validEmail).slice(0, 200)
    const map = await lastSignInMap(emails)
    res.status(200).json({
      ok: true,
      lastSignIn: map,
      serviceConfigured: !!SB_SERVICE,
    })
    return
  }

  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method' }); return }

  const body = req.body || {}
  const email = normEmail(body.email)
  const fullName = String(body.fullName || body.full_name || '').trim().slice(0, 120)
  const dialpad = toE164(body.dialpad || body.phone || '')
  const portalRole = (body.portalRole === 'admin' || body.admin === true) ? 'admin' : 'planner'
  const redirectTo = String(body.redirectTo || body.redirect_to || '').slice(0, 500) || undefined
  const dryRun = body.dryRun === true || body.preview === true

  if (!validEmail(email)) { res.status(200).json({ ok: false, error: 'Enter a valid company email address' }); return }
  if (portalRole === 'admin' && admin._portalRole !== 'super_admin' && admin._portalRole !== 'admin') {
    res.status(403).json({ ok: false, error: 'Cannot grant administrator access' }); return
  }
  /* Never create another super_admin through this path. */
  if (body.portalRole === 'super_admin') {
    res.status(200).json({ ok: false, error: 'Super Admin cannot be assigned here' }); return
  }

  if (dryRun) {
    res.status(200).json({
      ok: true,
      mode: 'dry_run',
      email,
      fullName,
      dialpad: dialpad || null,
      portalRole,
      serviceConfigured: !!SB_SERVICE,
      message: 'Dry-run only — no account or invite was created.',
    })
    return
  }

  const allow = await upsertAllowlist(userHeaders(admin._accessToken), {
    email, full_name: fullName, role: portalRole, approved: true,
  })
  if (!allow.ok) {
    res.status(200).json({ ok: false, error: allow.error || 'Could not update allowlist', stage: 'allowlist' })
    return
  }

  const auth = await inviteOrCreateAuth(email, fullName, redirectTo)
  res.status(200).json({
    ok: !!auth.ok,
    email,
    fullName,
    dialpad: dialpad || null,
    portalRole,
    allowlist: true,
    invite: auth,
    serviceConfigured: !!SB_SERVICE,
    message: auth.ok
      ? (auth.emailed ? 'Account linked and invitation sent.' : 'Account linked.')
      : (auth.message || 'Allowlist updated; invitation could not be completed.'),
  })
}
