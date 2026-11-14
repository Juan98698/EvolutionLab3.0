import { spawn } from 'node:child_process';
const env = { ...process.env };
if (Number(process.versions.node.split('.')[0]) >= 25) {
  env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --no-experimental-webstorage`.trim();
}
const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', code => { process.exitCode = code ?? 1; });
