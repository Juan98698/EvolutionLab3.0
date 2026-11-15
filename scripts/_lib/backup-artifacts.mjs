import assert from 'node:assert/strict';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function encryptArtifact(bytes, key, format = 'ELSB1') {
  assert.equal(key.length, 32, 'Clave de respaldo incorrecta.');
  assert.equal(Buffer.byteLength(format), 5, 'Formato de respaldo incorrecto.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([Buffer.from(format), iv, cipher.getAuthTag(), body]);
}
export function decryptArtifact(bytes, key, format = 'ELSB1') {
  assert.equal(key.length, 32, 'Clave de respaldo incorrecta.');
  assert(bytes.length >= 33 && bytes.subarray(0, 5).equals(Buffer.from(format)), 'Formato de respaldo incorrecto.');
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(5, 17));
  decipher.setAuthTag(bytes.subarray(17, 33));
  return Buffer.concat([decipher.update(bytes.subarray(33)), decipher.final()]);
}
