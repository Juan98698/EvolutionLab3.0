// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// package.json usa "type": "module", así que en Vercel las funciones de api/
// corren como ESM puro y Node exige la extensión en los imports relativos que
// se ejecutan. Vitest los resuelve igual sin extensión, por eso un import
// './_lib/plans' pasaba los tests pero tumbaba la función en producción con
// ERR_MODULE_NOT_FOUND ("A server error has occurred").
const API_DIR = join(__dirname, '..');

function apiSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : apiSourceFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

describe('api/: imports relativos compatibles con ESM en Vercel', () => {
  it('todo import relativo que se ejecuta lleva extensión .js', () => {
    const offenders: string[] = [];
    for (const file of apiSourceFiles(API_DIR)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/^import\s+(?!type\b)[^;]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/gm)) {
        if (!match[1].endsWith('.js')) offenders.push(`${file.replace(API_DIR, 'api')}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
