import { createClient } from '@supabase/supabase-js'
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './supabaseEnv.js'

/** Service role client — server only. Never import from browser bundles. */
export function getSupabaseAdmin() {
  const url = getSupabaseUrl()
  const key = getSupabaseServiceRoleKey()
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
