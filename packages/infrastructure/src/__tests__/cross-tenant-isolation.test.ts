import {
  DestinationKind,
  Provider,
  Workflow,
  WorkflowRun,
  WorkflowStep,
  WorkspaceId,
} from '@flowmind/domain';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaWorkflowRepository } from '../persistence/prisma-workflow-repository.js';
import { PrismaWorkflowRunRepository } from '../persistence/prisma-workflow-run-repository.js';

import { createTestWorkspace, deleteTestWorkspace } from './helpers/test-workspace.js';

function buildWorkflow(workspaceId: WorkspaceId, name: string): Workflow {
  return Workflow.create({
    name,
    workspaceId,
    steps: [
      WorkflowStep.trigger({ kind: 'webhook' }),
      WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
      WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
    ],
  });
}

/**
 * The isolation guarantee proved against a real database, not a fake: the
 * workspace filter has to be in the SQL, not in an assertion the repository
 * makes after loading a row it should never have selected.
 */
describe.skipIf(!process.env.DATABASE_URL)('cross-tenant isolation (real Postgres)', () => {
  const prisma = new PrismaClient();
  const workflows = new PrismaWorkflowRepository(prisma);
  const runs = new PrismaWorkflowRunRepository(prisma);

  const workspaceA = WorkspaceId.generate();
  const workspaceB = WorkspaceId.generate();

  let workflowOfA: Workflow;
  let workflowOfB: Workflow;
  let runOfB: WorkflowRun;

  beforeAll(async () => {
    await createTestWorkspace(prisma, workspaceA);
    await createTestWorkspace(prisma, workspaceB);

    workflowOfA = buildWorkflow(workspaceA, 'A owns this');
    workflowOfB = buildWorkflow(workspaceB, 'B owns this');
    await workflows.save(workflowOfA);
    await workflows.save(workflowOfB);

    runOfB = WorkflowRun.create({ workflowId: workflowOfB.id, workspaceId: workspaceB });
    await runs.save(runOfB);
  });

  afterAll(async () => {
    await prisma.workflowRun.deleteMany({
      where: { workflowId: { in: [workflowOfA.id.value, workflowOfB.id.value] } },
    });
    await prisma.workflow.deleteMany({
      where: { id: { in: [workflowOfA.id.value, workflowOfB.id.value] } },
    });
    await deleteTestWorkspace(prisma, workspaceA);
    await deleteTestWorkspace(prisma, workspaceB);
    await prisma.$disconnect();
  });

  it('workspace A can read its own workflow', async () => {
    const found = await workflows.findById(workflowOfA.id, workspaceA);

    expect(found).not.toBeNull();
    expect(found?.name).toBe('A owns this');
  });

  it('workspace A CANNOT read workspace B’s workflow — null, not an error', async () => {
    await expect(workflows.findById(workflowOfB.id, workspaceA)).resolves.toBeNull();
  });

  it('workspace A CANNOT read workspace B’s workflow run', async () => {
    await expect(runs.findViewById(runOfB.id, workspaceA)).resolves.toBeNull();
    await expect(runs.findViewById(runOfB.id, workspaceB)).resolves.not.toBeNull();
  });

  it('listing runs never returns another workspace’s runs', async () => {
    const viewsForA = await runs.listViews(workspaceA);
    const viewsForB = await runs.listViews(workspaceB);

    expect(viewsForA.some((view) => view.id === runOfB.id.value)).toBe(false);
    expect(viewsForB.some((view) => view.id === runOfB.id.value)).toBe(true);
  });

  it('a saved workflow keeps the workspace it was created in even after an update', async () => {
    const renamed = Workflow.create({
      id: workflowOfA.id,
      name: 'A renamed it',
      workspaceId: workflowOfA.workspaceId,
      steps: workflowOfA.steps,
    });
    await workflows.save(renamed);

    const row = await prisma.workflow.findUniqueOrThrow({ where: { id: workflowOfA.id.value } });
    expect(row.workspaceId).toBe(workspaceA.value);
    await expect(workflows.findById(workflowOfA.id, workspaceB)).resolves.toBeNull();
  });
});
