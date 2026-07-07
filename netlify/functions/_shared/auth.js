import { createClient } from '@supabase/supabase-js'
import { getSupabaseAnonKey, getSupabaseUrl } from './supabaseEnv.js'

/** Extract a bearer token from a web-standard Request. */
export function bearerFrom(req) {
  const h = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  if (!h.toLowerCase().startsWith('bearer ')) return ''
  return h.slice(7).trim()
}

/** Resolve the signed-in Supabase user from a bearer JWT (read-only). */
export async function getUserFromJwt(jwt) {
  const url = getSupabaseUrl()
  const anon = getSupabaseAnonKey()
  if (!url || !anon || !jwt) return { user: null, error: 'Auth not configured.' }
  const supabase = createClient(url, anon)
  const { data, error } = await supabase.auth.getUser(jwt)
  if (error || !data?.user?.id) return { user: null, error: error?.message || 'Invalid session.' }
  return { user: data.user, error: '' }
}

/** JSON Response helper for Netlify Functions v2. */
export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
