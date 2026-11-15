import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { parseEnv } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { encryptArtifact, decryptArtifact, sha256 } from './_lib/backup-artifacts.mjs';

const root = process.cwd();
const env = Object.assign({}, ...['.env', '.env.local'].filter(existsSync).map(file => parseEnv(readFileSync(file, 'utf8'))), process.env);
const windows = process.platform === 'win32';
// Supabase's restore guide excludes these managed vector-storage catalogs.
const dataFlags = '--data-only --use-copy --exclude storage.buckets_vectors,storage.vector_indexes';
const privatePath = value => {
  const path = resolve(root, value);
  assert(path.startsWith(resolve(root, 'scratch') + sep), 'Los artefactos deben permanecer en scratch/, excluido de Git.');
  return path;
};

// No credentials enter command arguments or error output. SQL output stays in
// memory until encrypted. Windows uses the native PostgreSQL clients in WSL.
function run(program, args, input = '', extraEnv = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(program, args, { windowsHide: true, env: { ...process.env, ...extraEnv }, stdio: ['pipe', 'pipe', 'pipe'] });
    const output = [];
    let size = 0;
    let diagnostic = '';
    const timer = setTimeout(() => child.kill(), 600000);
    child.stdout.on('data', data => {
      size += data.length;
      if (size > 536870912) child.kill();
      else output.push(data);
    });
    child.stderr.on('data', data => { if (diagnostic.length < 100000) diagnostic += data.toString(); });
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); reject(Error('No se pudo iniciar la herramienta de respaldo.')); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0 || size > 536870912) {
        const auth = /password authentication failed|no password supplied/i.test(diagnostic);
        const state = diagnostic.match(/ERROR:\s+([A-Z0-9]{5})\b/)?.[1];
        let redacted = diagnostic;
        for (const [name, value] of Object.entries(env)) {
          if (/PASSWORD|TOKEN|KEY|SECRET|DATABASE_URL/.test(name) && value) {
            redacted = redacted.replaceAll(value, '<redacted>').replaceAll(encodeURIComponent(value), '<redacted>');
          }
        }
        redacted = redacted.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '<jwt>');
        const firstError = redacted.split('\n').filter(line => /error|failed|cannot|invalid|unsupported|unknown|suggestion|flags in the group/i.test(line) && !/^\s*(COPY|INSERT|UPDATE|SELECT|DETAIL:|CONTEXT:)/i.test(line)).slice(0, 3).join(' ');
        const safeError = firstError?.replace(/'(?:''|[^'])*'/g, "'<redacted>'").replace(/postgres(?:ql)?:\/\/\S+/gi, '<connection>').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<email>').slice(0, 350);
        reject(Error(auth ? 'La conexión de PostgreSQL rechazó la contraseña configurada.' : `La herramienta ${program} terminó con código ${code}${state ? ` (SQLSTATE ${state})` : ''}.${safeError ? ` ${safeError}` : ''} Se omiten las filas y el resto del diagnóstico.`));
      } else resolveResult(Buffer.concat(output));
    });
    child.stdin.end(input);
  });
}
const native = (tool, args, input = '', pgEnv = {}) => {
  const keys = Object.keys(pgEnv);
  const extraEnv = { ...pgEnv, WSLENV: [process.env.WSLENV, ...keys.map(key => `${key}/u`)].filter(Boolean).join(':') };
  return windows ? run('wsl.exe', ['-d', 'Ubuntu', '--', tool, ...args], input, extraEnv) : run(tool, args, input, pgEnv);
};
const sql = (text, pgEnv) => native('psql', ['-X', '-q', '-A', '-t', '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=sqlstate', '--file=-'], text, pgEnv);
const snapshot = async pgEnv => JSON.parse((await sql(readFileSync('supabase/verification/restore_manifest.sql', 'utf8'), pgEnv)).toString().trim());
const comparable = manifest => {
  const { generatedAt: _time, ...rest } = manifest;
  const canonical = value => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const result = canonical(rest);
  // These catalog inventories are sets. Source and target database collations
  // can order their names differently; ordinal columns and row data are still
  // checked by their separate, order-aware fingerprints.
  for (const name of ['tables', 'publicFunctions', 'publicPolicies', 'constraints', 'customTriggers', 'extensionsToReviewBeforeClone']) {
    const identity = value => typeof value === 'string' ? value
      : [value.schema || '', value.table || '', value.name || '', value.arguments || ''].join('\u0000');
    if (Array.isArray(result[name])) result[name].sort((a, b) => identity(a) < identity(b) ? -1 : identity(a) > identity(b) ? 1 : 0);
  }
  return result;
};
function connectionEnvironment(kind) {
  assert(env[`${kind}_DATABASE_URL`] && env[`${kind}_DATABASE_PASSWORD`], `Completa ${kind}_DATABASE_PASSWORD en .env.local.`);
  let connection;
  try { connection = new URL(env[`${kind}_DATABASE_URL`]); } catch { throw Error(`${kind}_DATABASE_URL no tiene un formato válido.`); }
  const supabaseUrl = kind === 'RESTORE' ? env.RESTORE_SUPABASE_URL : env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  assert(supabaseUrl, 'Falta la URL de Supabase del proyecto seleccionado.');
  const project = new URL(supabaseUrl).hostname.split('.')[0];
  if (kind === 'RESTORE') assert.notEqual(project, new URL(env.VITE_SUPABASE_URL || env.SUPABASE_URL).hostname.split('.')[0], 'El destino de restauración debe ser distinto del origen.');
  assert(['postgres:', 'postgresql:'].includes(connection.protocol) && !connection.password && !connection.hash, 'Usa una URL PostgreSQL sin contraseña; la contraseña tiene su campo separado.');
  assert((connection.hostname === `db.${project}.supabase.co` && connection.username === 'postgres') || (connection.hostname.endsWith('.pooler.supabase.com') && connection.username === `postgres.${project}`), 'La conexión no corresponde al proyecto de Supabase seleccionado.');
  return { PGHOST: connection.hostname, PGPORT: connection.port || '5432', PGUSER: connection.username, PGPASSWORD: env[`${kind}_DATABASE_PASSWORD`], PGDATABASE: connection.pathname.slice(1) || 'postgres', PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '20' };
}

async function template(flags = '') {
  const comments = flags.includes('--data-only') ? '' : '--keep-comments';
  const command = `npx --offline --package=supabase@3.1.0 -- supabase db dump --remote=postgresql://postgres@localhost:5432/postgres --dry-run --output-format text --agent no ${comments} ${flags}`;
  // This shell command is entirely constant; actual database configuration is
  // passed only to native() through environment variables, never interpolated.
  const bytes = windows
    ? await run('cmd.exe', ['/d', '/s', '/c', command], '', { PGPASSWORD: '', SUPABASE_DB_PASSWORD: '', SUPABASE_ACCESS_TOKEN: '' })
    : await run('sh', ['-c', command], '', { PGPASSWORD: '', SUPABASE_DB_PASSWORD: '', SUPABASE_ACCESS_TOKEN: '' });
  const output = bytes.toString().replaceAll('\r\n', '\n');
  const start = output.indexOf('#!/usr/bin/env bash');
  assert(start >= 0, 'La CLI no devolvió un script de respaldo reconocido.');
  const script = output.slice(start).replace(/^export PG(?:HOST|PORT|USER|PASSWORD|DATABASE)=.*$/gm, '');
  assert(!/^export PG(?:HOST|PORT|USER|PASSWORD|DATABASE)=/m.test(script), 'No se pudieron aislar los parámetros de conexión.');
  assert(script.includes('pg_dump'), 'Script de respaldo no reconocido.');
  return script;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
if (process.argv[2] === '--check-data-export') {
  console.log('CHECK data export template');
  const script = await template(dataFlags);
  console.log('CHECK native data export');
  const bytes = await native('bash', ['-s'], script, connectionEnvironment('SOURCE'));
  console.log(JSON.stringify({ dataExportReadable: true, bytes: bytes.length, rowsPrinted: false }));
} else if (process.argv[2] === '--inspect-source') {
  const result = await sql(`SELECT jsonb_build_object(
    'postgresVersion', current_setting('server_version'),
    'tablesWithoutSelect', (SELECT COALESCE(jsonb_agg(n.nspname || '.' || c.relname ORDER BY n.nspname, c.relname), '[]'::jsonb)
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'auth', 'storage', 'net', 'cron', 'supabase_functions')
        AND c.relkind IN ('r','p') AND NOT has_table_privilege(c.oid, 'SELECT'))
  );`, connectionEnvironment('SOURCE'));
  console.log(result.toString().trim());
} else if (process.argv[2] === '--inspect-destination') {
  const result = JSON.parse((await sql(`SELECT jsonb_build_object(
    'postgresVersion', current_setting('server_version'),
    'applicationTables', (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public'),
    'authUsers', (SELECT count(*) FROM auth.users),
    'storageObjects', (SELECT count(*) FROM storage.objects)
  );`, connectionEnvironment('RESTORE'))).toString().trim());
  assert.equal(result.applicationTables, 0, 'El destino contiene tablas; revisar antes de restaurar.');
  assert.equal(result.authUsers, 0, 'El destino contiene usuarios; revisar antes de restaurar.');
  assert.equal(result.storageObjects, 0, 'El destino contiene archivos; revisar antes de restaurar.');
  console.log(JSON.stringify({ destinationIsEmpty: true, separateFromProduction: true, ...result }));
} else if (process.argv[2] === '--check-tools') {
  const version = (await native('pg_dump', ['--version'])).toString().trim();
  for (const flags of ['--role-only', '', dataFlags]) await template(flags);
  console.log(JSON.stringify({ toolsReady: true, client: version, supabaseCli: '3.1.0', credentialsUsed: false, databaseConnected: false }));
} else if (process.argv[2] === '--verify') {
  assert(process.argv[3] && process.argv[4], 'Uso: --verify <directorio> <archivo-clave>');
  const directory = privatePath(process.argv[3]);
  const key = readFileSync(privatePath(process.argv[4]));
  const manifest = JSON.parse(decryptArtifact(readFileSync(resolve(directory, 'manifest.bin')), key, 'ELDB1').toString());
  for (const item of manifest.files) {
    assert(/^[a-z_]+\.bin$/.test(item.file), 'Ruta de artefacto incorrecta.');
    const bytes = decryptArtifact(readFileSync(resolve(directory, item.file)), key, 'ELDB1');
    assert.equal(bytes.length, item.bytes, 'Tamaño de respaldo distinto al manifiesto.');
    assert.equal(sha256(bytes), item.sha256, 'Respaldo distinto al manifiesto.');
  }
  key.fill(0);
  console.log(JSON.stringify({ verified: true, artifacts: manifest.files.length, remoteRestoreVerified: false }));
} else {
  assert(!process.argv[2], 'Argumento de respaldo no reconocido.');
  const source = new URL(env.VITE_SUPABASE_URL || env.SUPABASE_URL).hostname.split('.')[0];
  const pgEnv = connectionEnvironment('SOURCE');
  console.log('CHECK inventario de origen de solo lectura');
  const before = await snapshot(pgEnv);
  const parts = new Map();
  for (const [name, flags] of [['roles', '--role-only'], ['schema', ''], ['data', dataFlags]]) {
    console.log(`BACKUP ${name}`);
    const script = await template(flags);
    if (name === 'data') assert(script.includes('buckets_vectors') && script.includes('vector_indexes'), 'La CLI omitió una exclusión de Storage.');
    parts.set(name, await native('bash', ['-s'], script, pgEnv));
  }
  console.log('BACKUP managed schema customizations');
  parts.set('managed_customizations', await sql(readFileSync('supabase/verification/export_managed_customizations.sql', 'utf8'), pgEnv));
  console.log('BACKUP exact application privileges');
  parts.set('application_grants', await sql(readFileSync('supabase/verification/export_application_grants.sql', 'utf8'), pgEnv));
  const history = (await sql("SELECT to_regnamespace('supabase_migrations') IS NOT NULL;", pgEnv)).toString().trim() === 't';
  if (history) {
    for (const [name, flags] of [['history_schema', '--schema supabase_migrations'], ['history_data', '--schema supabase_migrations --data-only --use-copy']]) {
      console.log(`BACKUP ${name}`);
      parts.set(name, await native('bash', ['-s'], await template(flags), pgEnv));
    }
  }
  console.log('VERIFY source unchanged during backup');
  const after = await snapshot(pgEnv);
  assert(JSON.stringify(comparable(after)) === JSON.stringify(comparable(before)), 'Los datos de origen cambiaron durante la copia; repite el respaldo antes de restaurar.');
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const directory = privatePath(`scratch/recovery-backups/${id}/database`);
  const keyFile = privatePath(`scratch/recovery-keys/${id}.key`);
  mkdirSync(directory, { recursive: true });
  mkdirSync(resolve(keyFile, '..'), { recursive: true });
  const key = randomBytes(32);
  writeFileSync(keyFile, key, { flag: 'wx', mode: 0o600 });
  const manifest = { version: 1, createdAt: new Date().toISOString(), sourceProject: source, supabaseCli: '3.1.0', snapshot: before, files: [] };
  for (const [name, bytes] of parts) {
    const file = `${name}.bin`;
    writeFileSync(resolve(directory, file), encryptArtifact(bytes, key, 'ELDB1'), { flag: 'wx', mode: 0o600 });
    manifest.files.push({ file, bytes: bytes.length, sha256: sha256(bytes) });
  }
  writeFileSync(resolve(directory, 'manifest.bin'), encryptArtifact(Buffer.from(JSON.stringify(manifest)), key, 'ELDB1'), { flag: 'wx', mode: 0o600 });
  key.fill(0);
  console.log(JSON.stringify({ backupCompleted: true, artifacts: manifest.files.length, tables: before.tables.length, sourceUnchangedDuringBackup: true, backupDirectory: relative(root, directory), keyFile: relative(root, keyFile), encrypted: true, remoteRestoreVerified: false }));
}
}

export { env, privatePath, native, sql, snapshot, comparable, connectionEnvironment };
