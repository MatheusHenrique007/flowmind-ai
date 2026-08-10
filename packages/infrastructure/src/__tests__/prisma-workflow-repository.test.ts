import { randomUUID } from 'node:crypto';

import {
  DestinationKind,
  Provider,
  StepType,
  Workflow,
  WorkflowId,
  WorkflowStep,
  WorkspaceId,
} from '@flowmind/domain';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaWorkflowRepository } from '../persistence/prisma-workflow-repository.js';

import { createTestWorkspace, deleteTestWorkspace } from './helpers/test-workspace.js';

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
  // Each run gets its own throwaway Workspace — never the pre-existing legacy
  // one, whose rows must survive untouched.
  const workspaceId = WorkspaceId.generate();
  const otherWorkspaceId = WorkspaceId.generate();

  beforeAll(async () => {
    await createTestWorkspace(prisma, workspaceId);
    await createTestWorkspace(prisma, otherWorkspaceId);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.workflow.deleteMany({ where: { id: { in: createdIds } } });
    }
    await deleteTestWorkspace(prisma, workspaceId);
    await deleteTestWorkspace(prisma, otherWorkspaceId);
    await prisma.$disconnect();
  });

  it('returns null for an id that does not exist', async () => {
    const result = await repository.findById(WorkflowId.generate(), workspaceId);
    expect(result).toBeNull();
  });

  it('reconstructs a Workflow with its Trigger/AI/Destination steps in order', async () => {
    const id = randomUUID();
    createdIds.push(id);
    await prisma.workflow.create({
      data: {
        id,
        name: 'Webhook to Slack (integration test)',
        workspaceId: workspaceId.value,
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

    const workflow = await repository.findById(WorkflowId.create(id), workspaceId);

    expect(workflow).not.toBeNull();
    expect(workflow?.name).toBe('Webhook to Slack (integration test)');
    expect(workflow?.steps.map((step) => step.type)).toEqual([
      StepType.TRIGGER,
      StepType.AI,
      StepType.DESTINATION,
    ]);
  });

  it('saves a new workflow and reads it back with the same steps', async () => {
    const workflow = Workflow.create({
      name: 'Created via save()',
      steps: [
        WorkflowStep.trigger({ kind: 'webhook' }),
        WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
        WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#eng' }),
      ],
      workspaceId,
    });
    createdIds.push(workflow.id.value);

    await repository.save(workflow);
    const reloaded = await repository.findById(workflow.id, workspaceId);

    expect(reloaded?.name).toBe('Created via save()');
    expect(reloaded?.steps.map((step) => step.type)).toEqual([
      StepType.TRIGGER,
      StepType.AI,
      StepType.DESTINATION,
    ]);
  });

  it('overwrites an existing workflow on a second save()', async () => {
    const workflow = Workflow.create({
      name: 'Original name',
      steps: [
        WorkflowStep.trigger({ kind: 'webhook' }),
        WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
        WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#eng' }),
      ],
      workspaceId,
    });
    createdIds.push(workflow.id.value);
    await repository.save(workflow);

    const updated = Workflow.create({
      id: workflow.id,
      name: 'Updated name',
      steps: [
        WorkflowStep.trigger({ kind: 'webhook' }),
        WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Classify urgency.' }),
        WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#eng' }),
      ],
      workspaceId,
    });
    await repository.save(updated);

    const reloaded = await repository.findById(workflow.id, workspaceId);
    expect(reloaded?.name).toBe('Updated name');
    expect(reloaded?.steps[1]?.config).toMatchObject({ instruction: 'Classify urgency.' });
  });
});
