import { fileURLToPath, pathToFileURL } from 'node:url';

import Fastify, { type FastifyInstance } from 'fastify';

import type { CompositionRoot } from './composition-root.js';
import { buildCompositionRoot } from './composition-root.js';
import { loadEnv } from './env.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerWorkflowRunRoutes } from './routes/workflow-runs.js';

export async function buildServer(root: CompositionRoot): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // OpenAPI/Swagger wiring lands in a later release, once more routes exist to document.
  app.get('/health', async () => root.checkHealth());

  await registerWebhookRoutes(app, { workflowQueue: root.workflowQueue });
  await registerWorkflowRunRoutes(app, {
    getWorkflowRun: root.getWorkflowRun,
    listWorkflowRuns: root.listWorkflowRuns,
  });

  return app;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const root = buildCompositionRoot(env);
  const app = await buildServer(root);

  const shutdown = async (): Promise<void> => {
    await app.close();
    await root.shutdown();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

// Only boot the server when this module is run directly (not when imported by tests).
// Built via pathToFileURL rather than string concatenation — a manual `file://${argv[1]}`
// comparison is wrong on Windows (backslashes, missing leading slash) and silently never boots.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // cwd is apps/api when run via `pnpm --filter`, not the repo root — resolve
  // .env relative to this file instead of relying on cwd.
  const { config: loadDotEnv } = await import('dotenv');
  loadDotEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
