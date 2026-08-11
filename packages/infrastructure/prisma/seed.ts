import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { PasswordHash } from '@flowmind/domain';
import { PrismaClient } from '@prisma/client';
import { config as loadDotEnv } from 'dotenv';

// cwd is packages/infrastructure when run via `pnpm --filter`, not the repo
// root — resolve .env relative to this file instead of relying on cwd.
loadDotEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const prisma = new PrismaClient();

// Not 'webhook-to-slack-demo': that id is pre-v0.4.0 legacy data, already
// preserved under legacy-workspace by the auth migration's backfill, and
// must never be reassigned or reused (see docs/adr/0004's amendment). The
// demo workflow gets its own, distinct id so it can freely belong to
// demo-workspace without touching that historical row.
const DEMO_WORKFLOW_ID = 'demo-webhook-to-slack';
// Workflows are workspace-owned since v0.4.0, so the seed needs a Workspace to
// hang the demo workflow off. Deliberately its own id, not the migration's
// legacy workspace: that one is historical data this script must not touch.
const DEMO_WORKSPACE_ID = 'demo-workspace';
// Every route is now authenticated (v0.4.0), so `pnpm demo` needs a real,
// loginable account owning this workspace — not just a placeholder
// `ownerUserId` with no matching `users` row. Fixed, documented credentials
// (dev-only data, real Postgres already has zero real users seeded here).
export const DEMO_USER_EMAIL = 'demo@flowmind.local';
export const DEMO_USER_PASSWORD = 'flowmind-demo-password';

async function main(): Promise<void> {
  const existingUser = await prisma.user.findUnique({ where: { email: DEMO_USER_EMAIL } });
  const demoUserId = existingUser?.id ?? randomUUID();

  // Workspace first: users.workspaceId is a real FK, so the workspace row
  // must exist before the user can reference it.
  await prisma.workspace.upsert({
    where: { id: DEMO_WORKSPACE_ID },
    create: {
      id: DEMO_WORKSPACE_ID,
      name: 'Demo Workspace (seeded)',
      ownerUserId: demoUserId,
    },
    update: {},
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        id: demoUserId,
        email: DEMO_USER_EMAIL,
        passwordHash: (await PasswordHash.hash(DEMO_USER_PASSWORD)).value,
        workspaceId: DEMO_WORKSPACE_ID,
      },
    });
  }

  await prisma.workflow.upsert({
    where: { id: DEMO_WORKFLOW_ID },
    create: {
      id: DEMO_WORKFLOW_ID,
      name: 'Webhook to Slack',
      workspaceId: DEMO_WORKSPACE_ID,
      steps: [
        { id: 'trigger-1', type: 'TRIGGER', config: { type: 'TRIGGER', kind: 'webhook' } },
        {
          id: 'ai-1',
          type: 'AI',
          config: {
            type: 'AI',
            provider: 'CLAUDE',
            instruction: 'Summarize the incoming message in two sentences.',
          },
        },
        {
          id: 'destination-1',
          type: 'DESTINATION',
          config: {
            type: 'DESTINATION',
            destination: 'SLACK',
            target: process.env.SLACK_CHANNEL ?? '#alerts',
          },
        },
      ],
    },
    update: {},
  });

  console.log(`Seeded workflow "${DEMO_WORKFLOW_ID}".`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
