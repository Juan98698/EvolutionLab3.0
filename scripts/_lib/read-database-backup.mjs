import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { decryptArtifact, sha256 } from './backup-artifacts.mjs';

export function readDatabaseBackup(directory, keyFile) {
  const key = readFileSync(keyFile);
  try {
    const manifest = JSON.parse(decryptArtifact(readFileSync(resolve(directory, 'manifest.bin')), key, 'ELDB1').toString());
    assert.equal(manifest.version, 1, 'Formato de respaldo desconocido.');
    const parts = new Map();
    for (const item of manifest.files) {
      assert(/^[a-z_]+\.bin$/.test(item.file), 'Ruta de artefacto no válida.');
      const bytes = decryptArtifact(readFileSync(resolve(directory, item.file)), key, 'ELDB1');
      assert.equal(bytes.length, item.bytes, 'Tamaño de artefacto no válido.');
      assert.equal(sha256(bytes), item.sha256, 'Integridad del artefacto incorrecta.');
      parts.set(item.file.replace('.bin', ''), bytes);
    }
    return { manifest, parts };
  } finally { key.fill(0); }
}
