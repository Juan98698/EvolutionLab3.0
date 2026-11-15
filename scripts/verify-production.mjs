import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

// Remote checks use disposable identities only. Never print credentials, user
// records or recovery links. This creates a checkout preference, never a payment.
const env = Object.assign({}, ...['.env', '.env.local'].filter(existsSync).map(file => parseEnv(readFileSync(file, 'utf8'))), process.env);
const origin = 'https://evolutionlab.fit';
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
assert(url && anon && env.SUPABASE_SERVICE_ROLE_KEY, 'Falta configuración de Supabase.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, options);
const ok = result => { if (result.error) throw Error(result.error.message); return result.data; };
const report = { origin, checkedAt: new Date().toISOString(), checks: [], blocked: [], paymentsCreated: 0, tariffsChanged: false };
const pass = (name, evidence = {}) => { report.checks.push({ name, passed: true, ...evidence }); console.log(`PASS ${name}`); };
const request = (path, init = {}) => fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(25000) });
let identity;
let client;
try {
  const page = await request('/login');
  assert.equal(page.status, 200);
  const html = await page.text();
  assert(/<div id="root">/.test(html), 'La portada no contiene la raíz de la aplicación.');
  pass('Portada del despliegue accesible por HTTPS', { status: page.status });

  const settingsResponse = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon }, signal: AbortSignal.timeout(20000) });
  assert(settingsResponse.ok, `Auth settings respondió ${settingsResponse.status}.`);
  const settings = await settingsResponse.json();
  assert.equal(settings.external?.google, true, 'Google no está habilitado en Supabase.');
  assert.equal(settings.external?.email, true, 'Email no está habilitado en Supabase.');
  pass('Proveedores Google y correo habilitados');
  const authorize = new URL(`${url}/auth/v1/authorize`);
  authorize.searchParams.set('provider', 'google');
  authorize.searchParams.set('redirect_to', `${origin}/login`);
  const oauth = await fetch(authorize, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  assert([302, 303].includes(oauth.status), `OAuth respondió ${oauth.status}.`);
  const target = new URL(oauth.headers.get('location'));
  assert.equal(target.hostname, 'accounts.google.com');
  const callback = new URL(target.searchParams.get('redirect_uri'));
  assert.equal(callback.origin, new URL(url).origin);
  assert.equal(callback.pathname, '/auth/v1/callback');
  pass('Inicio OAuth redirige a Google con callback de Supabase', { consentAndReturnVerified: false });

  for (const [name, path, body, headers] of [
    ['Checkout sin JWT rechazado', '/api/create-mercadopago-preference', { plan: 'premium', redirectPath: '/dashboard' }, {}],
    ['Webhook sin firma rechazado', '/api/mercadopago-webhook?data.id=production-readiness-probe&type=payment', { type: 'payment', data: { id: 'production-readiness-probe' }, live_mode: false }, {}],
    ['Webhook con firma falsa rechazado', '/api/mercadopago-webhook?data.id=production-readiness-probe&type=payment', { type: 'payment', data: { id: 'production-readiness-probe' }, live_mode: false }, { 'x-request-id': randomUUID(), 'x-signature': `ts=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}` }],
  ]) {
    const response = await request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body) });
    assert.equal(response.status, 401, `${name}: HTTP ${response.status}.`);
    pass(name, { status: response.status });
  }

  const email = `evolution-production-${randomUUID()}@example.test`;
  const password = `${randomUUID()}aA9!`;
  identity = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { rol: 'cliente', nombre: 'Verificación producción' } })).user.id;
  client = createClient(url, anon, options);
  const { session } = ok(await client.auth.signInWithPassword({ email, password }));
  const profile = ok(await client.from('profiles').select('id,rol').eq('id', identity).single());
  assert.equal(profile.rol, 'cliente');
  pass('Acceso por contraseña y lectura del perfil real de Supabase');
  const recovery = ok(await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: `${origin}/login` } }));
  const recoveryLink = new URL(recovery.properties.action_link);
  const recoveryTarget = new URL(recoveryLink.searchParams.get('redirect_to'));
  assert.equal(recoveryTarget.origin, origin);
  assert.equal(recoveryTarget.pathname, '/login');
  pass('Enlace de recuperación admite el dominio y la ruta publicados', { emailDeliveryVerified: false, passwordChangeVerified: false });

  const checkout = await request('/api/create-mercadopago-preference', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ plan: 'premium', redirectPath: '/dashboard', amount: 1, userId: 'untrusted-client-id' }) });
  assert.equal(checkout.status, 200, `Checkout remoto respondió ${checkout.status}.`);
  const preference = await checkout.json();
  const checkoutUrl = new URL(preference.url);
  assert.match(checkoutUrl.hostname, /(^|\.)mercadopago\.com(\.[a-z]{2})?$/);
  pass('Checkout de Vercel crea preferencia autenticada', { checkoutHost: checkoutUrl.hostname, sandboxRedirect: checkoutUrl.hostname.startsWith('sandbox.') });
  if (env.MERCADOPAGO_ACCESS_TOKEN) {
    const detailResponse = await fetch(`https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(preference.id)}`, { headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(20000) });
    if (!detailResponse.ok) {
      report.blocked.push({ check: 'Consulta de la preferencia remota', status: detailResponse.status, reason: 'Las credenciales locales no autorizan consultar la preferencia creada por Vercel; confirmar vendedor y entorno del despliegue.' });
      console.log(`BLOCKED Consulta de la preferencia remota: HTTP ${detailResponse.status}`);
      process.exitCode = 1;
    } else {
      const detail = await detailResponse.json();
      assert.equal(detail.metadata?.user_id, identity);
      assert.equal(detail.metadata?.plan, 'premium');
      assert.equal(detail.items[0].unit_price, 19900);
      assert.equal(detail.items[0].currency_id, 'COP');
      assert.equal(detail.notification_url, `${origin}/api/mercadopago-webhook`);
      assert.equal(new URL(detail.back_urls.success).origin, origin);
      const sellerResponse = await fetch('https://api.mercadopago.com/users/me', { headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(20000) });
      assert(sellerResponse.ok, 'No se pudo verificar el vendedor.');
      const seller = await sellerResponse.json();
      pass('Preferencia remota verificada contra Mercado Pago', { identityFromJwt: true, amount: 19900, currency: 'COP', sellerIsTestUser: seller.tags?.includes('test_user') === true });
    }
  }
  ok(await client.auth.signOut());
  const afterLogout = await client.auth.getSession();
  assert.equal(afterLogout.data.session, null);
  pass('Cierre de sesión de la cuenta desechable');
} finally {
  if (identity) {
    ok(await admin.auth.admin.deleteUser(identity));
    report.cleanupCompleted = true;
    console.log('CLEANUP cuenta desechable eliminada');
  }
  console.log(JSON.stringify(report, null, 2));
}
