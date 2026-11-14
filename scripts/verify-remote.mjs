import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

// Credentials stay in memory; reports contain pass/fail checks, never tokens.
const env = Object.assign({}, ...['.env', '.env.local'].filter(existsSync).map(file => parseEnv(readFileSync(file, 'utf8'))), process.env);
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) throw Error('Configura URL, anon key y service role de Supabase en el entorno local.');
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const client = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const report = [];
const pass = name => { report.push({ check: name, passed: true }); console.log(`PASS ${name}`); };
const ok = result => { if (result.error) throw Error(result.error.message); return result.data; };
const response = await fetch(`${url}/rest/v1/`, { headers: { apikey: service, Authorization: `Bearer ${service}` }, signal: AbortSignal.timeout(20000) });
if (!response.ok) throw Error(`Supabase no disponible (${response.status}).`);
const schema = await response.json();
for (const name of ['record_training_session', 'apply_verified_payment', 'request_coach_invitation', 'respond_coach_invitation', 'pending_coach_invitations']) {
  assert(schema.paths?.[`/rpc/${name}`], `Falta ${name}: aplica supabase/release/20261113_security_and_reliability.sql.`);
}
pass('Esquema remoto y funciones disponibles');
if (!process.argv.includes('--integration')) process.exit(0);
for (const table of ['sesiones_historial', 'sesiones_ejercicios']) {
  ok(await admin.from(table).select('id').limit(0));
}

const run = `evolution-verify-${randomUUID()}`;
const created = [];
async function user(role, suffix) {
  const email = `${run}-${suffix}@example.test`;
  const password = randomUUID() + 'aA9!';
  const data = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre: `Verificación ${suffix}`, rol: role } }));
  const id = data.user.id;
  const session = client();
  created.push({ id });
  ok(await session.auth.signInWithPassword({ email, password }));
  return { id, email, client: session };
}
try {
  const coachA = await user('entrenador', 'coach-a');
  const coachB = await user('entrenador', 'coach-b');
  const athleteA = await user('cliente', 'athlete-a');
  const athleteB = await user('cliente', 'athlete-b');
  for (const coach of [coachA, coachB]) ok(await admin.from('profiles').update({ suscripcion_plan: 'profesional', suscripcion_estado: 'activo', suscripcion_expira_at: new Date(Date.now() + 86400000).toISOString() }).eq('id', coach.id));
  ok(await admin.from('profiles').update({ entrenador_id: coachA.id }).eq('id', athleteA.id));
  ok(await admin.from('profiles').update({ entrenador_id: coachB.id }).eq('id', athleteB.id));
  assert.equal(ok(await coachA.client.from('profiles').select('id').eq('id', athleteB.id)).length, 0);
  assert.equal(ok(await athleteA.client.from('profiles').select('id').eq('id', athleteB.id)).length, 0);
  assert.equal(ok(await coachA.client.from('profiles').select('id').eq('id', athleteA.id)).length, 1);
  pass('Dos entrenadores y dos atletas: aislamiento y acceso al propio equipo');
  await athleteA.client.from('profiles').update({ rol: 'admin' }).eq('id', athleteA.id);
  await athleteA.client.from('profiles').update({ suscripcion_plan: 'profesional' }).eq('id', athleteA.id);
  const protectedProfile = ok(await admin.from('profiles').select('rol,suscripcion_plan').eq('id', athleteA.id).single());
  assert.equal(protectedProfile.rol, 'cliente');
  assert.notEqual(protectedProfile.suscripcion_plan, 'profesional');
  pass('Bloqueo de escalado de rol y manipulación de suscripción');

  const payload = { fecha: new Date().toISOString().slice(0, 10), notas_sesion: 'Prueba desechable', ejercicios: [{ nombre_ejercicio: 'Press de prueba', grupo_muscular: 'pecho', series_reps: [8, 8], peso: 20, rpe_rir: 2, descanso: 90, volumen: 320, rm_estimado: 25 }] };
  const args = { p_cliente_id: athleteA.id, p_operation_id: run, p_session: payload };
  const first = ok(await athleteA.client.rpc('record_training_session', args));
  const repeat = ok(await athleteA.client.rpc('record_training_session', args));
  assert.equal(first.id, repeat.id);
  assert.equal(first.ejercicios.length, 1);
  assert((await coachB.client.rpc('record_training_session', args)).error);
  pass('Sesión atómica, reintento idempotente y rechazo del entrenador ajeno');

  ok(await admin.from('profiles').update({ entrenador_id: null }).eq('id', athleteB.id));
  ok(await coachA.client.rpc('request_coach_invitation', { p_email: athleteB.email, p_modality: 'remoto' }));
  assert.equal(ok(await coachA.client.from('profiles').select('id').eq('id', athleteB.id)).length, 0);
  const invitations = ok(await athleteB.client.rpc('pending_coach_invitations'));
  assert.equal(invitations.length, 1);
  ok(await athleteB.client.rpc('respond_coach_invitation', { p_id: invitations[0].id, p_accept: true }));
  assert.equal(ok(await coachA.client.from('profiles').select('id').eq('id', athleteB.id)).length, 1);
  pass('Invitación sin acceso previo y aceptación explícita del atleta');

  const now = new Date().toISOString();
  const payment = { p_payment_id: run, p_user_id: athleteA.id, p_plan: 'premium', p_status: 'approved', p_approved_at: now, p_updated_at: now };
  assert((await athleteA.client.rpc('apply_verified_payment', payment)).error);
  pass('Ledger de pagos inaccesible al cliente autenticado');
  // No fake approved payments are inserted in the live ledger. Ordering,
  // refunds and renewal calculations run against real PostgreSQL in Vitest.
  console.log(JSON.stringify({ checks: report.length, passed: true, billingLedgerWrites: 0 }));
} finally {
  // Restrict cleanup to IDs returned by this run's createUser calls.
  const failures = [];
  for (const { id } of created.reverse()) {
    for (const key of ['athlete_id', 'coach_id']) {
      const invitations = await admin.from('coach_invitations').delete().eq(key, id);
      if (invitations.error) failures.push(invitations.error.message);
    }
    const histories = await admin.from('sesiones_historial').select('id').eq('cliente_id', id);
    if (!histories.error) {
      for (const session of histories.data) {
        const deletion = await admin.from('sesiones_ejercicios').delete().eq('sesion_id', session.id);
        if (deletion.error) failures.push(deletion.error.message);
      }
      const deletion = await admin.from('sesiones_historial').delete().eq('cliente_id', id);
      if (deletion.error) failures.push(deletion.error.message);
    } else failures.push(histories.error.message);
    const deletion = await admin.auth.admin.deleteUser(id);
    if (deletion.error) failures.push(deletion.error.message);
  }
  if (failures.length) { console.error('CLEANUP incompleto:', [...new Set(failures)].join('; ')); process.exitCode = 1; }
  else console.log('CLEANUP cuentas desechables eliminadas');
}
