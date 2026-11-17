/**
 * Shared auth gate for every /api route.
 *
 * Replaces the old fixed "?k=" key, which was embedded in the public page.
 * A caller must now send the signed-in user's Supabase session token:
 *   Authorization: Bearer <access_token>
 * The token is verified with Supabase Auth, then the portal allowlist is checked
 * with the database function pb_is_approved() (evaluated as that user).
 *
 * The URL and publishable key below are public by design (they are in the page);
 * no secret is required. Override with SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY.
 */
const SB_URL = String(process.env.SUPABASE_URL || 'https://itgintixzfcvoiuwszdx.supabase.co').replace(/\/+$/, '')
const SB_KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_o8oGWpu7NummrXxrN2-MHA_hjEoRI_M')
const SB_SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

function bearerToken(req) {
  const h = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '')
  const m = h.match(/^Bearer\s+(\S+)$/i)
  return m ? m[1] : null
}

function userHeaders(token) {
  return { apikey: SB_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
}

function serviceHeaders() {
  if (!SB_SERVICE) return null
  return { apikey: SB_SERVICE, Authorization: 'Bearer ' + SB_SERVICE, 'Content-Type': 'application/json' }
}

/** Returns the Supabase user when the caller is signed in AND approved; otherwise
 *  writes a 401/403 JSON response and returns null. Never throws. */
async function requireApprovedUser(req, res) {
  try {
    const token = bearerToken(req)
    if (!token) { res.status(401).json({ ok: false, error: 'Sign in required' }); return null }
    const headers = userHeaders(token)

    const u = await fetch(SB_URL + '/auth/v1/user', { headers })
    if (!u.ok) { res.status(401).json({ ok: false, error: 'Session expired — sign in again' }); return null }
    const user = await u.json().catch(() => null)
    if (!user || !user.id) { res.status(401).json({ ok: false, error: 'Sign in required' }); return null }

    const a = await fetch(SB_URL + '/rest/v1/rpc/pb_is_approved', {
      method: 'POST', headers: Object.assign({}, headers), body: '{}',
    })
    const approved = a.ok ? await a.json().catch(() => false) : false
    if (approved !== true) { res.status(403).json({ ok: false, error: 'Not approved for this portal' }); return null }
    user._accessToken = token
    return user
  } catch (e) {
    res.status(503).json({ ok: false, error: 'Auth check unavailable' })
    return null
  }
}

/** Approved + admin/super_admin on prebooking_users. Attaches ._portalRole. */
async function requirePortalAdmin(req, res) {
  const user = await requireApprovedUser(req, res)
  if (!user) return null
  try {
    const email = String(user.email || '').toLowerCase()
    const headers = userHeaders(user._accessToken)
    const r = await fetch(
      SB_URL + '/rest/v1/prebooking_users?email=eq.' + encodeURIComponent(email) + '&select=email,role,approved,full_name',
      { headers }
    )
    const rows = r.ok ? await r.json().catch(() => []) : []
    const row = Array.isArray(rows) ? rows[0] : null
    const role = row && row.role
    if (role !== 'admin' && role !== 'super_admin') {
      res.status(403).json({ ok: false, error: 'Administrator access required' })
      return null
    }
    user._portalRole = role
    user._portalName = (row && row.full_name) || ''
    return user
  } catch (e) {
    res.status(503).json({ ok: false, error: 'Admin check unavailable' })
    return null
  }
}

module.exports = { requireApprovedUser, requirePortalAdmin, SB_URL, SB_KEY, SB_SERVICE, serviceHeaders, userHeaders }
