import { pathToFileURL } from 'node:url';

import Fastify from 'fastify';

import { loadEnv } from './env.js';
import { getHealthStatus } from './health.js';

export function buildServer() {
  const app = Fastify({ logger: true });

  // OpenAPI/Swagger wiring lands in a later release, once real routes exist to document.
  app.get('/health', async () => getHealthStatus());

  return app;
}

async function main() {
  const env = loadEnv();
  const app = buildServer();

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

// Only boot the server when this module is run directly (not when imported by tests).
// Built via pathToFileURL rather than string concatenation — a manual `file://${argv[1]}`
// comparison is wrong on Windows (backslashes, missing leading slash) and silently never boots.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
