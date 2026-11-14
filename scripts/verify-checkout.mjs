import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'vite';

// Exercise the current checkout handler with real Supabase authentication and
// a verified Mercado Pago test seller. Creates a preference, never a payment.
const env = Object.assign({}, ...['.env', '.env.local'].filter(existsSync).map(file => parseEnv(readFileSync(file, 'utf8'))), process.env);
const accessToken = env.MERCADOPAGO_ACCESS_TOKEN;
assert(accessToken, 'Falta MERCADOPAGO_ACCESS_TOKEN.');
const mp = async path => {
  const response = await fetch(`https://api.mercadopago.com${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20000) });
  assert(response.ok, `Mercado Pago respondió ${response.status}.`);
  return response.json();
};
const seller = await mp('/users/me');
assert(seller.tags?.includes('test_user'), 'Esta comprobación exige un vendedor de pruebas; no crea preferencias con una cuenta real.');
console.log('PASS vendedor de Mercado Pago confirmado como test_user');
Object.assign(process.env, env, { MERCADOPAGO_SANDBOX: 'true', APP_PRODUCTION_ORIGIN: 'https://evolutionlab.fit' });
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
assert(url && anon && env.SUPABASE_SERVICE_ROLE_KEY, 'Falta configuración de Supabase.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, options);
const client = createClient(url, anon, options);
const ok = result => { if (result.error) throw Error(result.error.message); return result.data; };
let identity;
let server;
try {
  const email = `evolution-checkout-${randomUUID()}@example.test`;
  const password = randomUUID() + 'aA9!';
  identity = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { rol: 'cliente', nombre: 'Verificación checkout' } })).user.id;
  const { session } = ok(await client.auth.signInWithPassword({ email, password }));
  server = await createServer({ cacheDir: 'node_modules/.vite-checkout', server: { middlewareMode: true }, appType: 'custom' });
  const { default: handler } = await server.ssrLoadModule('/api/create-mercadopago-preference.ts');
  const req = { method: 'POST', headers: { authorization: `Bearer ${session.access_token}`, origin: 'https://evolutionlab.fit', host: 'evolutionlab.fit' }, body: { plan: 'premium', redirectPath: '/dashboard', amount: 1, userId: 'untrusted-client-id' } };
  const res = { statusCode: 200, data: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
  await handler(req, res);
  assert.equal(res.statusCode, 200, res.data?.error);
  assert.match(new URL(res.data.url).hostname, /^sandbox\.mercadopago\./);
  const preference = await mp(`/checkout/preferences/${encodeURIComponent(res.data.id)}`);
  assert.equal(preference.items[0].unit_price, 19900);
  assert.equal(preference.items[0].currency_id, 'COP');
  assert.equal(preference.metadata.user_id, identity);
  assert.equal(preference.metadata.plan, 'premium');
  assert.equal(new URL(preference.back_urls.success).origin, 'https://evolutionlab.fit');
  assert.equal(preference.notification_url, 'https://evolutionlab.fit/api/mercadopago-webhook');
  console.log(JSON.stringify({ checkout: 'passed', sandbox: true, amount: 19900, currency: 'COP', identityFromJwt: true, paymentsCreated: 0, tariffsChanged: false }));
} finally {
  await server?.close();
  if (identity) { ok(await admin.auth.admin.deleteUser(identity)); console.log('CLEANUP cuenta de checkout eliminada'); }
}
