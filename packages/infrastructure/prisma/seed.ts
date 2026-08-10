import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';
import { config as loadDotEnv } from 'dotenv';

// cwd is packages/infrastructure when run via `pnpm --filter`, not the repo
// root — resolve .env relative to this file instead of relying on cwd.
loadDotEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const prisma = new PrismaClient();

const DEMO_WORKFLOW_ID = 'webhook-to-slack-demo';
// Workflows are workspace-owned since v0.4.0, so the seed needs a Workspace to
// hang the demo workflow off. Deliberately its own id, not the migration's
// legacy workspace: that one is historical data this script must not touch.
const DEMO_WORKSPACE_ID = 'demo-workspace';

async function main(): Promise<void> {
  // ownerUserId is a placeholder — the demo workspace has no registered
  // owner, and Workspace.ownerUserId is intentionally not a foreign key
  // (see schema.prisma). Register an account to get a real, owned workspace.
  await prisma.workspace.upsert({
    where: { id: DEMO_WORKSPACE_ID },
    create: {
      id: DEMO_WORKSPACE_ID,
      name: 'Demo Workspace (seeded)',
      ownerUserId: 'seed',
    },
    update: {},
  });

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
