import { readdir, readFile } from 'node:fs/promises';
const files = await readdir('dist/assets');
for (const file of files.filter(name => name.endsWith('.js'))) {
  const content = await readFile(`dist/assets/${file}`, 'utf8');
  if (/mock-jwt|_playwright_test|test-client-id|e2e=true/.test(content)) {
    throw new Error(`Test-only code found in production: ${file}`);
  }
}
console.log('Production bundle contains no E2E identity or simulation switches.');
