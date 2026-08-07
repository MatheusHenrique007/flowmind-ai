import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_WORKFLOW_ID = 'webhook-to-slack-demo';

async function main(): Promise<void> {
  await prisma.workflow.upsert({
    where: { id: DEMO_WORKFLOW_ID },
    create: {
      id: DEMO_WORKFLOW_ID,
      name: 'Webhook to Slack',
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
