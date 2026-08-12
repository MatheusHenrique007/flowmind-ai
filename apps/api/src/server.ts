import { fileURLToPath, pathToFileURL } from 'node:url';

import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

import { buildRequireAuth } from './auth/require-auth.js';
import type { CompositionRoot } from './composition-root.js';
import { buildCompositionRoot } from './composition-root.js';
import { allowedOrigins, loadEnv, type Env } from './env.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerScheduleRoutes } from './routes/schedules.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerWorkflowRunRoutes } from './routes/workflow-runs.js';
import { registerWorkflowRoutes } from './routes/workflows.js';

export async function buildServer(root: CompositionRoot, env: Env): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // An explicit allow-list, not the previous `origin: true` (reflect-any):
  // `credentials: true` is required for the browser to send the refresh cookie,
  // and reflect-any + credentials would let any site drive an authenticated
  // session. See PRD v0.4.0 / ADR-0003.
  await app.register(cors, { origin: allowedOrigins(env), credentials: true });

  const requireAuth = buildRequireAuth(root.tokenService);

  // OpenAPI/Swagger wiring lands in a later release, once more routes exist to document.
  // /health stays public — it exposes no tenant data and is what deploys probe.
  app.get('/health', async () => root.checkHealth());

  await registerAuthRoutes(app, {
    registerUser: root.registerUser,
    loginUser: root.loginUser,
    refreshSession: root.refreshSession,
    logoutUser: root.logoutUser,
    getCurrentUser: root.getCurrentUser,
    requireAuth,
    // Browsers reject Secure cookies over plain http://localhost, so the
    // attribute is set everywhere except local development.
    secureCookies: env.NODE_ENV !== 'development',
  });
  await registerWebhookRoutes(app, { workflowQueue: root.workflowQueue, requireAuth });
  await registerWorkflowRunRoutes(app, {
    getWorkflowRun: root.getWorkflowRun,
    listWorkflowRuns: root.listWorkflowRuns,
    requireAuth,
  });
  await registerWorkflowRoutes(app, {
    createWorkflow: root.createWorkflow,
    updateWorkflow: root.updateWorkflow,
    requireAuth,
  });
  await registerScheduleRoutes(app, {
    createSchedule: root.createSchedule,
    listSchedules: root.listSchedules,
    deleteSchedule: root.deleteSchedule,
    computeNextRunAt: root.computeNextRunAt,
    requireAuth,
  });

  return app;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const root = buildCompositionRoot(env);
  const app = await buildServer(root, env);

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
