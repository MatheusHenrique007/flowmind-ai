import { randomUUID } from 'node:crypto';

import { StepType, WorkflowId } from '@flowmind/domain';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { PrismaWorkflowRepository } from '../persistence/prisma-workflow-repository.js';

/**
 * Real integration test against Postgres — not mocked. Skips gracefully
 * without DATABASE_URL (e.g. local dev without Docker running) rather than
 * failing or pretending to pass; runs for real in CI, which provisions a
 * Postgres service (.github/workflows/ci.yml). Creates its own uniquely-id'd
 * rows rather than truncating shared tables — must never wipe another
 * process's (or a local dev seed's) data when run against a shared database.
 */
describe.skipIf(!process.env.DATABASE_URL)('PrismaWorkflowRepository', () => {
  const prisma = new PrismaClient();
  const repository = new PrismaWorkflowRepository(prisma);
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.workflow.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.$disconnect();
  });

  it('returns null for an id that does not exist', async () => {
    const result = await repository.findById(WorkflowId.generate());
    expect(result).toBeNull();
  });

  it('reconstructs a Workflow with its Trigger/AI/Destination steps in order', async () => {
    const id = randomUUID();
    createdIds.push(id);
    await prisma.workflow.create({
      data: {
        id,
        name: 'Webhook to Slack (integration test)',
        steps: [
          { id: 'trigger-1', type: 'TRIGGER', config: { type: 'TRIGGER', kind: 'webhook' } },
          {
            id: 'ai-1',
            type: 'AI',
            config: { type: 'AI', provider: 'CLAUDE', instruction: 'Summarize.' },
          },
          {
            id: 'destination-1',
            type: 'DESTINATION',
            config: { type: 'DESTINATION', destination: 'SLACK', target: '#alerts' },
          },
        ],
      },
    });

    const workflow = await repository.findById(WorkflowId.create(id));

    expect(workflow).not.toBeNull();
    expect(workflow?.name).toBe('Webhook to Slack (integration test)');
    expect(workflow?.steps.map((step) => step.type)).toEqual([
      StepType.TRIGGER,
      StepType.AI,
      StepType.DESTINATION,
    ]);
  });
});
