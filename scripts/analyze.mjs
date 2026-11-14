import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit', env: { ...process.env, ANALYZE: 'true' },
});
child.on('exit', code => { process.exitCode = code ?? 1; });
