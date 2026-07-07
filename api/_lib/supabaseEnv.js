/**
 * Server-side Supabase env (Vercel functions). Do not log values.
 * Accepts the portal's VITE_* names as well as the un-prefixed server names.
 */
export function getSupabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
}

export function getSupabaseAnonKey() {
  return String(
    process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      '',
  ).trim()
}

export function getSupabaseServiceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
}
