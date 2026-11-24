/**
 * GET  /api/team-org — load reporting hierarchy (prebooking_state id=team_org)
 * POST /api/team-org — save hierarchy (admin: full; leader: own direct reports only)
 *
 * Validates circular manager chains. Org structure is backend-authoritative and
 * separate from the travel plan blob so UI hiding alone cannot grant access.
 */
const {
  requireApprovedUser, SB_URL, userHeaders, serviceHeaders,
} = require('./_lib/auth')

const ORG_ID = 'team_org'

function normEmail(v) {
  return String(v || '').trim().toLowerCase()
}

function detectCycles(members) {
  const byId = {}
  ;(members || []).forEach((m) => { if (m && m.id) byId[m.id] = m })
  for (const id of Object.keys(byId)) {
    const seen = {}
    let cur = id
    let steps = 0
    while (cur) {
      if (seen[cur]) return { ok: false, error: 'Circular reporting relationship involving ' + cur }
      seen[cur] = 1
      const m = byId[cur]
      cur = m && m.managerId ? m.managerId : null
      if (++steps > 80) return { ok: false, error: 'Reporting chain too deep' }
    }
  }
  return { ok: true }
}

function normalizeMembers(members) {
  return (members || []).map((m) => ({
    id: m.id,
    name: m.name || '',
    email: normEmail(m.email),
    role: m.role || '',
    terr: m.terr || '',
    terrs: Array.isArray(m.terrs) ? m.terrs : [],
    managerId: m.managerId || null,
    eaFor: Array.isArray(m.eaFor) ? m.eaFor : [],
    portalRole: m.portalRole || 'employee',
    accessGroup: m.accessGroup || 'standard',
    isAdmin: !!m.isAdmin,
    active: m.active !== false,
  }))
}

async function readOrg(headers) {
  const r = await fetch(
    SB_URL + '/rest/v1/prebooking_state?id=eq.' + encodeURIComponent(ORG_ID) + '&select=id,data,version',
    { headers }
  )
  if (!r.ok) return { ok: false, status: r.status, error: 'Could not read team org' }
  const rows = await r.json().catch(() => [])
  const row = Array.isArray(rows) ? rows[0] : null
  return { ok: true, data: (row && row.data) || { version: 1, members: [] }, version: row ? row.version : null }
}

async function writeOrg(headers, data) {
  const payload = { id: ORG_ID, data: data, updated_at: new Date().toISOString() }
  let r = await fetch(SB_URL + '/rest/v1/prebooking_state?on_conflict=id', {
    method: 'POST',
    headers: Object.assign({}, headers, { Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify([payload]),
  })
  if (r.ok) return { ok: true, data: await r.json().catch(() => data) }
  r = await fetch(SB_URL + '/rest/v1/prebooking_state?id=eq.' + encodeURIComponent(ORG_ID), {
    method: 'PATCH',
    headers: Object.assign({}, headers, { Prefer: 'return=representation' }),
    body: JSON.stringify({ data: data, updated_at: payload.updated_at }),
  })
  if (r.ok) return { ok: true, data: await r.json().catch(() => data) }
  r = await fetch(SB_URL + '/rest/v1/prebooking_state', {
    method: 'POST',
    headers: Object.assign({}, headers, { Prefer: 'return=representation' }),
    body: JSON.stringify([payload]),
  })
  if (r.ok) return { ok: true, data: await r.json().catch(() => data) }
  const err = await r.json().catch(() => ({}))
  return { ok: false, error: (err && err.message) || ('status ' + r.status) }
}

async function portalRoleFor(user) {
  const email = normEmail(user.email)
  const headers = userHeaders(user._accessToken)
  const r = await fetch(
    SB_URL + '/rest/v1/prebooking_users?email=eq.' + encodeURIComponent(email) + '&select=email,role,approved,full_name',
    { headers }
  )
  const rows = r.ok ? await r.json().catch(() => []) : []
  const row = Array.isArray(rows) ? rows[0] : null
  return row ? row.role : null
}

function memberIndex(list) {
  const byId = {}
  ;(list || []).forEach((m) => { if (m && m.id) byId[m.id] = m })
  return byId
}

/** Leaders may only claim/release direct reports under themselves; cannot edit portalRole/eaFor/admin. */
function applyLeaderPatch(prevMembers, nextMembers, selfId) {
  const prev = memberIndex(prevMembers)
  const next = memberIndex(nextMembers)
  const out = normalizeMembers(prevMembers)
  const outBy = memberIndex(out)

  for (const id of Object.keys(next)) {
    const n = next[id]
    const p = prev[id] || outBy[id]
    if (!p && !outBy[id]) {
      /* Leaders cannot create roster rows via this API */
      continue
    }
    const row = outBy[id] || Object.assign({}, n)
    if (!outBy[id]) out.push(row)

    const prevMgr = p ? (p.managerId || null) : null
    const nextMgr = n.managerId || null

    if (nextMgr === selfId) {
      if (id === selfId) return { ok: false, error: 'Cannot report to yourself' }
      row.managerId = selfId
    } else if (prevMgr === selfId && nextMgr !== selfId) {
      /* Releasing a direct report */
      row.managerId = null
    } else if (nextMgr !== prevMgr) {
      return { ok: false, error: 'Leaders can only assign or release their own direct reports' }
    }

    /* Preserve privileged fields from previous unless unchanged */
    if (p) {
      row.portalRole = p.portalRole
      row.eaFor = Array.isArray(p.eaFor) ? p.eaFor.slice() : []
      row.isAdmin = !!p.isAdmin
      row.accessGroup = p.accessGroup
      row.active = p.active !== false
    }
  }
  return { ok: true, members: out }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const user = await requireApprovedUser(req, res)
    if (!user) return
    const headers = serviceHeaders() || userHeaders(user._accessToken)
    const read = await readOrg(headers)
    if (!read.ok) return res.status(502).json(read)
    return res.status(200).json({ ok: true, data: read.data, version: read.version })
  }

  if (req.method === 'POST') {
    const user = await requireApprovedUser(req, res)
    if (!user) return
    const role = await portalRoleFor(user)
    const isAdmin = role === 'admin' || role === 'super_admin'
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const incoming = Array.isArray(body.members) ? body.members : []
    const cycle = detectCycles(incoming)
    if (!cycle.ok) return res.status(400).json(cycle)

    const headers = serviceHeaders() || userHeaders(user._accessToken)
    const existing = await readOrg(headers)
    const prevMembers = (existing.ok && existing.data && existing.data.members) || []

    let members
    if (isAdmin) {
      members = normalizeMembers(incoming)
    } else {
      const email = normEmail(user.email)
      const self =
        incoming.find((m) => normEmail(m.email) === email) ||
        prevMembers.find((m) => normEmail(m.email) === email)
      if (!self || !self.id) {
        return res.status(403).json({ ok: false, error: 'Your employee profile was not found in the roster' })
      }
      const patched = applyLeaderPatch(prevMembers.length ? prevMembers : incoming, incoming, self.id)
      if (!patched.ok) return res.status(403).json(patched)
      members = patched.members
      const again = detectCycles(members)
      if (!again.ok) return res.status(400).json(again)
    }

    const data = {
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: normEmail(user.email),
      members: members,
    }
    const w = await writeOrg(headers, data)
    if (!w.ok) return res.status(502).json(w)
    return res.status(200).json({ ok: true, data: data })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
