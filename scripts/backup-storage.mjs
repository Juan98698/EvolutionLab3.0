import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { parseEnv } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { encryptArtifact as seal, decryptArtifact as open, sha256 as sha } from './_lib/backup-artifacts.mjs';

// Back up Storage independently of PostgreSQL. Paths and metadata are encrypted
// too. The key remains in a different ignored directory and is never printed.
const root = process.cwd();
const env = Object.assign({}, ...['.env', '.env.local'].filter(existsSync).map(file => parseEnv(readFileSync(file, 'utf8'))), process.env);
const ok = result => { if (result.error) throw Error(result.error.message); return result.data; };
const privatePath = value => {
  const path = resolve(root, value);
  const scratch = resolve(root, 'scratch');
  assert(path.startsWith(scratch + sep), 'Los artefactos deben permanecer en scratch/, excluido de Git.');
  return path;
};
const inventory = async (client, buckets) => {
  const objects = [];
  const walk = async (bucket, prefix = '') => {
    for (let offset = 0; ; offset += 100) {
      const entries = ok(await client.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }));
      for (const entry of entries) {
        assert(!['.', '..'].includes(entry.name) && !entry.name.includes('/'), 'Nombre de objeto no válido.');
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) await walk(bucket, path);
        else objects.push({ bucket, path, contentType: entry.metadata?.mimetype, cacheControl: entry.metadata?.cacheControl, updatedAt: entry.updated_at, expectedBytes: entry.metadata?.size });
      }
      if (entries.length < 100) break;
    }
  };
  for (const bucket of buckets) await walk(bucket.id);
  return objects;
};

if (['--verify', '--verify-source'].includes(process.argv[2])) {
  assert(process.argv[3] && process.argv[4], 'Uso: node scripts/backup-storage.mjs --verify <directorio> <archivo-clave>');
  const directory = privatePath(process.argv[3]);
  const key = readFileSync(privatePath(process.argv[4]));
  assert.equal(key.length, 32, 'Clave de respaldo incorrecta.');
  const manifest = JSON.parse(open(readFileSync(resolve(directory, 'manifest.bin')), key).toString());
  for (const object of manifest.objects) {
    assert(/^\d{8}\.bin$/.test(object.blob), 'Ruta de objeto no válida.');
    const bytes = open(readFileSync(resolve(directory, object.blob)), key);
    assert.equal(bytes.length, object.bytes, 'Tamaño distinto al manifiesto.');
    assert.equal(sha(bytes), object.sha256, 'Contenido distinto al manifiesto.');
  }
  let sourceMetadataUnchanged;
  if (process.argv[2] === '--verify-source') {
    const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
    assert(url && env.SUPABASE_SERVICE_ROLE_KEY, 'Falta configuración de Supabase.');
    assert.equal(new URL(url).hostname, manifest.sourceHost, 'El origen no coincide con el respaldo.');
    const client = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const currentBuckets = ok(await client.storage.listBuckets());
    assert.deepEqual(currentBuckets.map(b => b.id).sort(), manifest.buckets.map(b => b.id).sort(), 'Cambió el inventario de buckets.');
    const current = await inventory(client, currentBuckets);
    const signatures = objects => objects.map(o => JSON.stringify([o.bucket, o.path, o.expectedBytes ?? null, o.updatedAt ?? null])).sort();
    assert.deepEqual(signatures(current), signatures(manifest.objects), 'Storage cambió durante o después de la copia; repetir el respaldo.');
    sourceMetadataUnchanged = true;
  }
  key.fill(0);
  console.log(JSON.stringify({ verified: true, files: manifest.objects.length, totalBytes: manifest.totalBytes, algorithm: 'AES-256-GCM + SHA-256', sourceMetadataUnchanged, remoteRestoreVerified: false }));
} else {
  assert(!process.argv[2], 'Argumento no reconocido. Usa --verify para comprobar un respaldo existente.');
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  assert(url && env.SUPABASE_SERVICE_ROLE_KEY, 'Falta configuración de Supabase.');
  const client = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const buckets = ok(await client.storage.listBuckets());
  const objects = await inventory(client, buckets);
  const maxBytes = Number(env.BACKUP_MAX_BYTES || 1_073_741_824);
  const estimatedBytes = objects.reduce((sum, object) => sum + Number(object.expectedBytes || 0), 0);
  assert(Number.isFinite(maxBytes) && maxBytes > 0 && estimatedBytes <= maxBytes, 'El inventario supera el límite de tamaño del respaldo.');
  console.log(JSON.stringify({ inventory: true, buckets: buckets.length, files: objects.length, estimatedBytes }));

  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const directory = privatePath(`scratch/recovery-backups/${id}/storage`);
  const keyFile = privatePath(`scratch/recovery-keys/${id}.key`);
  mkdirSync(directory, { recursive: true });
  mkdirSync(resolve(keyFile, '..'), { recursive: true });
  const key = randomBytes(32);
  writeFileSync(keyFile, key, { flag: 'wx', mode: 0o600 });
  const manifest = { version: 1, createdAt: new Date().toISOString(), sourceHost: new URL(url).hostname, buckets, objects: [], totalBytes: 0 };
  for (const [index, object] of objects.entries()) {
    const data = ok(await client.storage.from(object.bucket).download(object.path));
    const bytes = Buffer.from(await data.arrayBuffer());
    manifest.totalBytes += bytes.length;
    assert(manifest.totalBytes <= maxBytes, 'El respaldo supera el límite de tamaño.');
    if (typeof object.expectedBytes === 'number') assert.equal(bytes.length, object.expectedBytes, 'Un objeto cambió durante el respaldo; repite la copia.');
    const blob = `${String(index).padStart(8, '0')}.bin`;
    const encrypted = seal(bytes, key);
    writeFileSync(resolve(directory, blob), encrypted, { flag: 'wx', mode: 0o600 });
    assert.equal(sha(open(encrypted, key)), sha(bytes), 'Falló la verificación del cifrado.');
    manifest.objects.push({ ...object, blob, bytes: bytes.length, sha256: sha(bytes) });
    if ((index + 1) % 25 === 0) console.log(`PROGRESS ${index + 1}/${objects.length}`);
  }
  writeFileSync(resolve(directory, 'manifest.bin'), seal(Buffer.from(JSON.stringify(manifest)), key), { flag: 'wx', mode: 0o600 });
  key.fill(0);
  console.log(JSON.stringify({ backupCompleted: true, files: manifest.objects.length, totalBytes: manifest.totalBytes, backupDirectory: relative(root, directory), keyFile: relative(root, keyFile), encrypted: true, remoteRestoreVerified: false }));
}
