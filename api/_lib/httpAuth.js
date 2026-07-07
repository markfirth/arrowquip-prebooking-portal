import { createClient } from '@supabase/supabase-js'
import { getSupabaseAnonKey, getSupabaseUrl } from './supabaseEnv.js'

export function readBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization
  if (typeof h !== 'string' || !h.toLowerCase().startsWith('bearer ')) return ''
  return h.slice(7).trim()
}

/** Resolve the signed-in Supabase user from a bearer JWT. */
async function getUserFromJwt(jwt) {
  const url = getSupabaseUrl()
  const anon = getSupabaseAnonKey()
  if (!url || !anon || !jwt) return { user: null, error: 'Auth not configured.' }
  const supabase = createClient(url, anon)
  const { data, error } = await supabase.auth.getUser(jwt)
  if (error || !data?.user?.id) return { user: null, error: error?.message || 'Invalid session.' }
  return { user: data.user, error: '' }
}

/**
 * Authorize an admin sync request. Two accepted paths:
 *  1. A signed-in Supabase user (Authorization: Bearer <jwt>). Any authenticated
 *     org member may trigger a read-only sync.
 *  2. A shared secret (x-sync-secret header) matching PREBOOK_SYNC_SECRET, so the
 *     sync can be triggered by an admin/cron without full auth wiring.
 * If PREBOOK_SYNC_SECRET is unset, only path (1) is available.
 */
export async function authorizeSync(req) {
  const secret = String(process.env.PREBOOK_SYNC_SECRET || '').trim()
  const provided = String(req.headers?.['x-sync-secret'] || req.headers?.['X-Sync-Secret'] || '').trim()
  if (secret && provided && provided === secret) {
    return { ok: true, via: 'secret', error: '' }
  }

  const jwt = readBearer(req)
  if (jwt) {
    const { user, error } = await getUserFromJwt(jwt)
    if (user) return { ok: true, via: 'user', userId: user.id, error: '' }
    return { ok: false, error: error || 'Invalid session.' }
  }

  return { ok: false, error: 'Sign in or provide a valid x-sync-secret.' }
}
