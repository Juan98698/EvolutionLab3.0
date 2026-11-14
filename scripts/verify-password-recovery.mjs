import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const env = Object.assign({}, ...['.env', '.env.local'].filter(existsSync).map(file => parseEnv(readFileSync(file, 'utf8'))), process.env);
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
assert(url && env.SUPABASE_SERVICE_ROLE_KEY && env.VITE_SUPABASE_ANON_KEY, 'Falta configuración privada de Supabase.');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, options);
const client = createClient(url, env.VITE_SUPABASE_ANON_KEY, options);
const email = `recovery-check-${randomUUID()}@example.com`;
const initialPassword = randomBytes(24).toString('base64url');
const newPassword = randomBytes(24).toString('base64url');
const checked = result => { if (result.error) throw Error(`Supabase rechazó una operación de prueba (${result.error.status || result.error.code || 'unknown'}).`); return result.data; };
let userId;
let passed = false;
try {
  const created = checked(await admin.auth.admin.createUser({ email, password: initialPassword, email_confirm: true, user_metadata: { nombre: 'Recovery verification', rol: 'cliente' } }));
  userId = created.user.id;
  // Admin generation is for this disposable account only; it sends no email.
  // Real delivery is checked separately through the user's own mailbox.
  const link = checked(await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: 'https://evolutionlab.fit/login' } }));
  const token = link.properties.email_otp;
  assert(token, 'No se generó un código de recuperación.');
  const verified = checked(await client.auth.verifyOtp({ email, token, type: 'recovery' }));
  assert.equal(verified.session?.user.id, userId, 'La sesión verificada no pertenece a la cuenta desechable.');
  checked(await client.auth.updateUser({ password: newPassword }));
  checked(await client.auth.signOut());
  const signedIn = checked(await client.auth.signInWithPassword({ email, password: newPassword }));
  assert.equal(signedIn.user.id, userId, 'No se pudo acceder con la contraseña nueva.');
  const independent = createClient(url, env.VITE_SUPABASE_ANON_KEY, options);
  const repeated = await independent.auth.verifyOtp({ email, token, type: 'recovery' });
  assert(repeated.error && !repeated.data.session, 'Un código de recuperación pudo reutilizarse.');
  passed = true;
} finally {
  await client.auth.signOut();
  if (userId) checked(await admin.auth.admin.deleteUser(userId));
  console.log(JSON.stringify({ remoteRecoveryVerified: passed, codeCreatesSession: passed, passwordUpdated: passed, newPasswordSignIn: passed, reusedCodeRejected: passed, disposableAccountCleaned: !!userId, emailDeliveryIncluded: false, credentialsPrinted: false }));
}
