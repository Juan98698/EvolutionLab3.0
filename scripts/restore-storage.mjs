import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { env, privatePath } from './backup-database.mjs';
import { decryptArtifact, sha256 } from './_lib/backup-artifacts.mjs';

assert(process.argv[2] && process.argv[3] && process.argv[4], 'Uso: node scripts/restore-storage.mjs <respaldo-storage> <archivo-clave> <comprobante-db>');
const directory = privatePath(process.argv[2]);
const proofFile = privatePath(process.argv[4]);
const proof = JSON.parse(readFileSync(proofFile, 'utf8'));
const key = readFileSync(privatePath(process.argv[3]));
const manifest = JSON.parse(decryptArtifact(readFileSync(resolve(directory, 'manifest.bin')), key).toString());
const sourceHost = new URL(env.VITE_SUPABASE_URL || env.SUPABASE_URL).hostname;
const targetUrl = new URL(env.RESTORE_SUPABASE_URL);
assert.equal(manifest.sourceHost, sourceHost, 'El respaldo no corresponde al origen configurado.');
assert.notEqual(targetUrl.hostname, sourceHost, 'Se prohíbe restaurar sobre producción.');
assert.equal(proof.targetProject, targetUrl.hostname.split('.')[0], 'El comprobante no pertenece al destino configurado.');
assert.equal(proof.sourceProject, sourceHost.split('.')[0], 'El comprobante no pertenece al origen configurado.');
assert(proof.databaseRestoreVerified && env.RESTORE_SUPABASE_SERVICE_ROLE_KEY, 'Primero verifica la base de datos y configura la clave privada del destino.');
const client = createClient(targetUrl.origin, env.RESTORE_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const checked = result => {
  if (result.error) throw Error(`Storage rechazó una operación (${result.error.statusCode || result.error.status || 'unknown'}). No se imprimen nombres ni contenidos de archivos.`);
  return result.data;
};

const buckets = checked(await client.storage.listBuckets());
assert.deepEqual(buckets.map(b => b.id).sort(), manifest.buckets.map(b => b.id).sort(), 'Los buckets del destino no coinciden con el respaldo.');
for (const bucket of buckets) assert.equal(bucket.public, manifest.buckets.find(b => b.id === bucket.id).public, 'El acceso público del bucket no coincide con el origen.');

// Authenticate every local artifact before beginning any upload.
for (const object of manifest.objects) {
  assert(/^\d{8}\.bin$/.test(object.blob), 'Ruta de artefacto no válida.');
  const bytes = decryptArtifact(readFileSync(resolve(directory, object.blob)), key);
  assert.equal(bytes.length, object.bytes, 'Tamaño distinto al manifiesto.');
  assert.equal(sha256(bytes), object.sha256, 'Contenido distinto al manifiesto.');
}

async function forEachObject(operation) {
  let index = 0;
  let completed = 0;
  let failure;
  const workers = Array.from({ length: Math.min(4, manifest.objects.length) }, async () => {
    while (!failure && index < manifest.objects.length) {
      const object = manifest.objects[index++];
      try {
        await operation(object);
        completed++;
        if (completed % 50 === 0) console.log(`PROGRESS ${completed}/${manifest.objects.length}`);
      } catch (error) { failure = error; }
    }
  });
  await Promise.allSettled(workers);
  if (failure) throw failure;
}

try {
  console.log('RESTORE Storage content into the verified isolated project');
  await forEachObject(async object => {
    const bytes = decryptArtifact(readFileSync(resolve(directory, object.blob)), key);
    const cacheControl = String(object.cacheControl || '3600').match(/^(?:max-age=)?(\d+)$/)?.[1] || '3600';
    // Database restore already supplied the object metadata. Upsert writes the
    // actual file to Storage; its managed version/timestamps can be refreshed.
    checked(await client.storage.from(object.bucket).upload(object.path, bytes, { upsert: true, contentType: object.contentType || 'application/octet-stream', cacheControl }));
  });
  console.log('VERIFY every restored file by downloading it and checking SHA-256');
  await forEachObject(async object => {
    const blob = checked(await client.storage.from(object.bucket).download(object.path));
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(bytes.length, object.bytes, 'Tamaño restaurado distinto al respaldo.');
    assert.equal(sha256(bytes), object.sha256, 'Contenido restaurado distinto al respaldo.');
  });
  const result = { ...proof, storageFilesVerified: true, storageVerifiedAt: new Date().toISOString(), files: manifest.objects.length, totalBytes: manifest.totalBytes, storageManagedMetadataMayRefresh: true };
  writeFileSync(proofFile, JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { key.fill(0); }
