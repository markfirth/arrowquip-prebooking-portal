// pb-passcode-login — custom auth: verify a shared team passcode server-side and mint a
// session for a shared approved account. The passcode and the shared account's password
// live in pb_secrets (service-role only) and never reach the browser. verify_jwt is off
// because THIS function IS the authentication step (no JWT exists yet).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

  let passcode = '';
  try { passcode = (await req.json())?.passcode ?? ''; } catch { /* ignore */ }

  const { data: rows, error: cfgErr } = await admin.from('pb_secrets').select('key,value');
  if (cfgErr) return json({ error: 'config' }, 500);
  const cfg: Record<string, string> = {};
  for (const r of rows ?? []) cfg[r.key] = r.value;

  const expected = cfg['trip_passcode'] ?? '';
  const ok = passcode.length === expected.length && passcode.length > 0 &&
    await (async () => { let d = 0; for (let i = 0; i < expected.length; i++) d |= passcode.charCodeAt(i) ^ expected.charCodeAt(i); return d === 0; })();
  if (!ok) return json({ ok: false, error: 'invalid_passcode' }, 401);

  const email = cfg['shared_email'];
  const password = cfg['shared_password'];

  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) {
    const { error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (cErr) return json({ error: 'create', detail: cErr.message }, 500);
  } else {
    await admin.auth.admin.updateUserById(existing.id, { password });
  }

  const authClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? svc, { auth: { persistSession: false } });
  const { data: sess, error: sErr } = await authClient.auth.signInWithPassword({ email, password });
  if (sErr || !sess?.session) return json({ error: 'signin', detail: sErr?.message }, 500);

  return json({ ok: true, access_token: sess.session.access_token, refresh_token: sess.session.refresh_token, expires_at: sess.session.expires_at });
});
