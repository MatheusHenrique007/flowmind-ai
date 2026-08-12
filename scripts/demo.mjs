#!/usr/bin/env node
// Runs the full FlowMind AI demo: brings up dependencies, seeds the demo
// workflow, boots the API, fires the webhook, and prints the result —
// exactly the flow in docs/demo/demo-script.md, automated.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

// Must match packages/infrastructure/prisma/seed.ts's DEMO_WORKFLOW_ID.
const DEMO_WORKFLOW_ID = 'demo-webhook-to-slack';
const REQUIRED_ENV_VARS = ['DATABASE_URL', 'REDIS_URL'];
// Must match packages/infrastructure/prisma/seed.ts's DEMO_USER_EMAIL/PASSWORD —
// every route requires auth since v0.4.0, so the demo needs a real access token.
const DEMO_USER_EMAIL = 'demo@flowmind.local';
const DEMO_USER_PASSWORD = 'flowmind-demo-password';

function loadDotEnv() {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function step(label) {
  console.log(`\n▶ ${label}`);
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exitCode = 1;
  return false;
}

function runSync(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  return result.status === 0;
}

async function waitFor(label, predicate, { timeoutMs = 30_000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await delay(intervalMs);
  }
  return fail(`Timed out waiting for: ${label}`);
}

async function main() {
  loadDotEnv();

  step('Checking required environment variables');
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    return fail(
      `Missing required environment variable(s): ${missing.join(', ')}.\n` +
        '  Copy .env.example to .env and fill in DATABASE_URL/REDIS_URL (docker-compose.yml provides matching defaults).',
    );
  }
  console.log('  DATABASE_URL and REDIS_URL are set.');

  step('Starting Postgres and Redis (docker compose up -d)');
  if (!runSync('docker', ['compose', 'up', '-d'])) {
    console.warn(
      '  docker compose failed or Docker is unavailable — continuing on the assumption Postgres/Redis are already reachable elsewhere.',
    );
  }

  // `prisma migrate deploy`, not `db push`: the project has real rows now, and
  // only a migration can express a backfill safely (docs/adr/0004-...).
  step('Applying Prisma migrations (prisma migrate deploy)');
  if (
    !runSync('pnpm', [
      '--filter',
      '@flowmind/infrastructure',
      'exec',
      'prisma',
      'migrate',
      'deploy',
    ])
  ) {
    return fail('Could not apply the Prisma migrations — is DATABASE_URL reachable?');
  }

  step('Seeding the demo workflow (pnpm seed)');
  if (!runSync('pnpm', ['seed'])) {
    return fail('Seeding failed.');
  }

  step('Starting the API (pnpm --filter @flowmind/api dev)');
  const port = process.env.PORT ?? '3001';
  const baseUrl = `http://localhost:${port}`;
  const api = spawn('pnpm', ['--filter', '@flowmind/api', 'dev'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env: process.env,
  });
  let apiOutput = '';
  api.stdout.on('data', (chunk) => (apiOutput += chunk.toString()));
  api.stderr.on('data', (chunk) => (apiOutput += chunk.toString()));

  const stopApi = () => {
    // `shell:true` on Windows spawns pnpm/tsx as a subtree api.kill() alone
    // doesn't reach — taskkill /t terminates the whole tree reliably.
    if (process.platform === 'win32' && api.pid) {
      spawnSync('taskkill', ['/pid', String(api.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      api.kill();
    }
  };
  process.on('exit', stopApi);

  const apiHealthy = await waitFor('API to respond on GET /health', async () => {
    try {
      const response = await fetch(`${baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  });
  if (!apiHealthy) {
    console.error(apiOutput);
    stopApi();
    return;
  }

  const health = await (await fetch(`${baseUrl}/health`)).json();
  console.log('  Health:', JSON.stringify(health));
  if (health.postgres !== 'ok' || health.redis !== 'ok') {
    stopApi();
    return fail('API is up but Postgres/Redis are not healthy — check docker compose ps.');
  }
  if (health.anthropic === 'not_configured' || health.slack === 'not_configured') {
    console.warn(
      '  ANTHROPIC_API_KEY and/or SLACK_BOT_TOKEN are not set — the demo will still run, but the AI or Slack step will fail with a clear error instead of succeeding.',
    );
  }

  step('Logging in as the seeded demo user (POST /auth/login)');
  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_USER_EMAIL, password: DEMO_USER_PASSWORD }),
  });
  if (!loginResponse.ok) {
    stopApi();
    return fail(`Login as the demo user failed with status ${loginResponse.status}.`);
  }
  const { accessToken } = await loginResponse.json();
  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  console.log('  Authenticated.');

  step(`Firing the webhook (POST /webhooks/${DEMO_WORKFLOW_ID})`);
  const webhookResponse = await fetch(`${baseUrl}/webhooks/${DEMO_WORKFLOW_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      text: 'Customer reported a checkout error and needs urgent help.',
    }),
  });
  if (!webhookResponse.ok) {
    stopApi();
    return fail(`Webhook call failed with status ${webhookResponse.status}.`);
  }
  console.log('  Accepted — queued for execution.');

  step('Waiting for the run to finish');
  let finishedRun;
  const finished = await waitFor('the run to reach a terminal status', async () => {
    const runs = await (await fetch(`${baseUrl}/workflow-runs`, { headers: authHeaders })).json();
    const latest = runs.find((run) => run.workflowId === DEMO_WORKFLOW_ID);
    if (latest && (latest.status === 'SUCCEEDED' || latest.status === 'FAILED')) {
      finishedRun = latest;
      return true;
    }
    return false;
  });

  if (finished && finishedRun) {
    console.log(`\n✔ Run ${finishedRun.id} finished with status ${finishedRun.status}`);
    for (const result of finishedRun.stepResults) {
      const outcome = result.status === 'SUCCEEDED' ? '✔' : '✖';
      console.log(
        `  ${outcome} step ${result.stepId} (${result.durationMs}ms)${result.error ? ` — ${result.error}` : ''}`,
      );
    }
    console.log(`\nFull history: ${baseUrl}/workflow-runs/${finishedRun.id}`);
  }

  stopApi();
  process.exitCode = 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
