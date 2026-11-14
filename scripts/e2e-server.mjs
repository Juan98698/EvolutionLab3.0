import { createServer } from 'vite';
process.env.EVOLUTION_E2E = '1';
const server = await createServer({ cacheDir: 'node_modules/.vite-e2e', server: { host: '127.0.0.1', port: 5185, strictPort: true } });
await server.listen();
server.printUrls();
