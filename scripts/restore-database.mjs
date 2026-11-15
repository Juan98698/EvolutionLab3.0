import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { env, privatePath, native, sql, snapshot, comparable, connectionEnvironment } from './backup-database.mjs';
import { decryptArtifact, sha256 } from './_lib/backup-artifacts.mjs';
import { applicationSnapshot } from './_lib/restore-comparison.mjs';

assert(process.argv[2] && process.argv[3], 'Uso: node scripts/restore-database.mjs <directorio> <archivo-clave> [--verify-only]');
assert(!process.argv[4] || process.argv[4] === '--verify-only', 'Argumento desconocido.');
const directory = privatePath(process.argv[2]);
const key = readFileSync(privatePath(process.argv[3]));
const manifest = JSON.parse(decryptArtifact(readFileSync(resolve(directory, 'manifest.bin')), key, 'ELDB1').toString());
assert.equal(manifest.version, 1, 'Formato de respaldo desconocido.');
assert.equal(manifest.sourceProject, new URL(env.VITE_SUPABASE_URL || env.SUPABASE_URL).hostname.split('.')[0], 'El respaldo no pertenece al proyecto de origen configurado.');
const targetProject = new URL(env.RESTORE_SUPABASE_URL).hostname.split('.')[0];
// A restore rehearsal must explicitly name a separate project. No fallback to
// source credentials, no drop/clean option and no writes before these guards.
assert.notEqual(targetProject, manifest.sourceProject, 'Se prohíbe restaurar sobre producción.');
const target = connectionEnvironment('RESTORE');
const parts = new Map();
for (const item of manifest.files) {
  assert(/^[a-z_]+\.bin$/.test(item.file), 'Ruta de artefacto no válida.');
  const bytes = decryptArtifact(readFileSync(resolve(directory, item.file)), key, 'ELDB1');
  assert.equal(bytes.length, item.bytes, 'Tamaño del artefacto no válido.');
  assert.equal(sha256(bytes), item.sha256, 'Integridad del artefacto incorrecta.');
  parts.set(item.file.replace('.bin', ''), bytes);
}
key.fill(0);
for (const required of ['roles', 'schema', 'data', 'managed_customizations', 'application_grants']) assert(parts.has(required), 'Respaldo incompleto.');

if (process.argv[4] !== '--verify-only') {
  const checks = JSON.parse((await sql(`SELECT jsonb_build_object(
    'tables', (SELECT count(*) FROM pg_tables WHERE schemaname = 'public'),
    'users', (SELECT count(*) FROM auth.users),
    'buckets', (SELECT count(*) FROM storage.buckets),
    'objects', (SELECT count(*) FROM storage.objects)
  );`, target)).toString());
  assert(Object.values(checks).every(value => value === 0), 'El proyecto de destino debe estar vacío. No se ha modificado.');

  // Queued network jobs and Vault secrets need a separate migration procedure.
  // Never start a clone that could repeat production outbound side effects.
  const outbound = JSON.parse((await sql(`DO $guard$
    DECLARE total bigint := 0; amount bigint;
    BEGIN
      IF to_regclass('cron.job') IS NOT NULL THEN EXECUTE 'SELECT count(*) FROM cron.job' INTO amount; total := total + amount; END IF;
      IF to_regclass('net.http_request_queue') IS NOT NULL THEN EXECUTE 'SELECT count(*) FROM net.http_request_queue' INTO amount; total := total + amount; END IF;
      IF to_regclass('vault.secrets') IS NOT NULL THEN EXECUTE 'SELECT count(*) FROM vault.secrets' INTO amount; total := total + amount; END IF;
      PERFORM set_config('evolution.restore_side_effects', total::text, false);
    END $guard$;
    SELECT jsonb_build_object('pendingSideEffectsOrVaultSecrets', current_setting('evolution.restore_side_effects')::bigint);`, connectionEnvironment('SOURCE'))).toString());
  assert.equal(outbound.pendingSideEffectsOrVaultSecrets, 0, 'Hay tareas externas o secretos de Vault; requieren una revisión específica antes de clonar.');

  const grantSql = parts.get('application_grants').toString();
  const delimiter = '$evolution_restore_acl_payload$';
  assert(!grantSql.includes(delimiter), 'Delimitador SQL inesperado.');
  const restoreGrants = `DO $evolution_restore_acl$ BEGIN EXECUTE ${delimiter}${grantSql}${delimiter}; END $evolution_restore_acl$;`;
  const script = [
    '\\set ON_ERROR_STOP on',
    parts.get('roles'), parts.get('schema'), parts.get('history_schema') || '',
    "SET session_replication_role = 'replica';",
    parts.get('data'), parts.get('history_data') || '',
    "SET session_replication_role = 'origin';",
    parts.get('managed_customizations'),
    restoreGrants,
  ].map(part => part.toString()).join('\n');
  console.log('RESTORE verified artifacts into the empty isolated project');
  await native('psql', ['-X', '-q', '--single-transaction', '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=sqlstate', '--file=-'], script, target);
}

console.log('VERIFY restored database against the backup snapshot');
const restored = await snapshot(target);
const application = await applicationSnapshot(restored, manifest.snapshot, text => sql(text, target));
const actual = comparable(application.snapshot);
const expected = comparable(manifest.snapshot);
const differences = Object.keys(expected).filter(name => JSON.stringify(actual[name]) !== JSON.stringify(expected[name]));
// Only metadata section names are reported, never restored row contents.
if (differences.length) console.log(JSON.stringify({ matching: false, differences }));
assert.equal(differences.length, 0, 'La restauración todavía no coincide con el respaldo.');
const proof = { verifiedAt: new Date().toISOString(), backupCreatedAt: manifest.createdAt, databaseRestoreVerified: true, sourceProject: manifest.sourceProject, targetProject, tables: restored.tables.length, artifacts: parts.size, preservedPlatformFunctions: application.preservedPlatformFunctions, storageFilesVerified: false };
writeFileSync(resolve(directory, 'restore-proof.json'), JSON.stringify(proof, null, 2), { mode: 0o600 });
console.log(JSON.stringify(proof));
