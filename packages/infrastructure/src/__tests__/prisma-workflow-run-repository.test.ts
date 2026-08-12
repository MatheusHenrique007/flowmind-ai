import { randomUUID } from 'node:crypto';

import {
  RunStatus,
  StepResultStatus,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkflowStepId,
  WorkflowStepResult,
  WorkspaceId,
} from '@flowmind/domain';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaWorkflowRunRepository } from '../persistence/prisma-workflow-run-repository.js';

import { createTestWorkspace, deleteTestWorkspace } from './helpers/test-workspace.js';

/**
 * Creates its own uniquely-id'd Workflow row rather than truncating shared
 * tables — this suite must never wipe another process's (or a local dev
 * seed's) data when run against a shared database.
 */
describe.skipIf(!process.env.DATABASE_URL)('PrismaWorkflowRunRepository', () => {
  const prisma = new PrismaClient();
  const repository = new PrismaWorkflowRunRepository(prisma);
  const workflowId = randomUUID();
  const workspaceId = WorkspaceId.generate();

  beforeAll(async () => {
    await createTestWorkspace(prisma, workspaceId);
    await prisma.workflow.create({
      data: {
        id: workflowId,
        name: 'Webhook to Slack (integration test)',
        steps: [],
        workspaceId: workspaceId.value,
      },
    });
  });

  afterAll(async () => {
    await prisma.workflowRun.deleteMany({ where: { workflowId } });
    await prisma.workflow.delete({ where: { id: workflowId } });
    await deleteTestWorkspace(prisma, workspaceId);
    await prisma.$disconnect();
  });

  it('returns null for a run id that does not exist', async () => {
    const view = await repository.findViewById(WorkflowRunId.generate(), workspaceId);
    expect(view).toBeNull();
  });

  it('persists a run across PENDING -> RUNNING -> SUCCEEDED and reads back the final view', async () => {
    const run = WorkflowRun.create({
      workflowId: WorkflowId.create(workflowId),
      workspaceId,
    });
    await repository.save(run);

    run.start();
    await repository.save(run);

    run.recordStepResult(
      WorkflowStepResult.succeeded({
        stepId: WorkflowStepId.generate(),
        output: { content: 'a short summary' },
        startedAt: new Date('2026-01-01T00:00:00Z'),
        finishedAt: new Date('2026-01-01T00:00:01Z'),
      }),
    );
    run.complete();
    await repository.save(run);

    const view = await repository.findViewById(run.id, workspaceId);

    expect(view?.status).toBe(RunStatus.SUCCEEDED);
    expect(view?.workflowId).toBe(workflowId);
    expect(view?.stepResults).toHaveLength(1);
    expect(view?.stepResults[0]?.status).toBe(StepResultStatus.SUCCEEDED);
    expect(view?.stepResults[0]?.durationMs).toBe(1000);
  });

  it('lists at least the run just created for this test workflow', async () => {
    const views = await repository.listViews(workspaceId);
    expect(views.some((view) => view.workflowId === workflowId)).toBe(true);
  });
});
