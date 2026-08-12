import { randomUUID } from 'node:crypto';

import { Schedule, ScheduleId, WorkflowId, WorkspaceId } from '@flowmind/domain';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaScheduleRepository } from '../persistence/prisma-schedule-repository.js';

import { createTestWorkspace, deleteTestWorkspace } from './helpers/test-workspace.js';

/**
 * Real integration test against Postgres — not mocked. Skips gracefully
 * without DATABASE_URL, matching PrismaWorkflowRepository.test.ts's
 * convention exactly.
 */
describe.skipIf(!process.env.DATABASE_URL)('PrismaScheduleRepository', () => {
  const prisma = new PrismaClient();
  const repository = new PrismaScheduleRepository(prisma);
  const workspaceId = WorkspaceId.generate();
  const otherWorkspaceId = WorkspaceId.generate();
  const createdWorkflowIds: string[] = [];

  beforeAll(async () => {
    await createTestWorkspace(prisma, workspaceId);
    await createTestWorkspace(prisma, otherWorkspaceId);
  });

  afterAll(async () => {
    if (createdWorkflowIds.length > 0) {
      await prisma.workflow.deleteMany({ where: { id: { in: createdWorkflowIds } } });
    }
    await deleteTestWorkspace(prisma, workspaceId);
    await deleteTestWorkspace(prisma, otherWorkspaceId);
    await prisma.$disconnect();
  });

  async function createTestWorkflow(ws: WorkspaceId): Promise<string> {
    const id = randomUUID();
    createdWorkflowIds.push(id);
    await prisma.workflow.create({
      data: {
        id,
        name: 'Schedule repo test workflow',
        workspaceId: ws.value,
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
    return id;
  }

  it('returns null for an id that does not exist', async () => {
    const result = await repository.findById(ScheduleId.generate(), workspaceId);
    expect(result).toBeNull();
  });

  it('saves a schedule and reads it back', async () => {
    const workflowId = await createTestWorkflow(workspaceId);
    const schedule = Schedule.create({
      workflowId: WorkflowId.create(workflowId),
      workspaceId,
      cronExpression: '*/5 * * * *',
    });

    await repository.save(schedule);
    const reloaded = await repository.findById(schedule.id, workspaceId);

    expect(reloaded?.cronExpression).toBe('*/5 * * * *');
    expect(reloaded?.workflowId.value).toBe(workflowId);
  });

  it('lists only the workspace-scoped schedules', async () => {
    const workflowId = await createTestWorkflow(workspaceId);
    const otherWorkflowId = await createTestWorkflow(otherWorkspaceId);
    const mine = Schedule.create({
      workflowId: WorkflowId.create(workflowId),
      workspaceId,
      cronExpression: '0 0 * * *',
    });
    const theirs = Schedule.create({
      workflowId: WorkflowId.create(otherWorkflowId),
      workspaceId: otherWorkspaceId,
      cronExpression: '0 0 * * *',
    });
    await repository.save(mine);
    await repository.save(theirs);

    const listed = await repository.listByWorkspace(workspaceId);
    expect(listed.some((s) => s.id.equals(mine.id))).toBe(true);
    expect(listed.some((s) => s.id.equals(theirs.id))).toBe(false);
  });

  it('returns null and no-ops on findById/delete for a cross-tenant schedule', async () => {
    const workflowId = await createTestWorkflow(otherWorkspaceId);
    const schedule = Schedule.create({
      workflowId: WorkflowId.create(workflowId),
      workspaceId: otherWorkspaceId,
      cronExpression: '0 0 * * *',
    });
    await repository.save(schedule);

    await expect(repository.findById(schedule.id, workspaceId)).resolves.toBeNull();

    await repository.delete(schedule.id, workspaceId);
    await expect(repository.findById(schedule.id, otherWorkspaceId)).resolves.not.toBeNull();
  });

  it('deletes a schedule scoped to its own workspace', async () => {
    const workflowId = await createTestWorkflow(workspaceId);
    const schedule = Schedule.create({
      workflowId: WorkflowId.create(workflowId),
      workspaceId,
      cronExpression: '0 0 * * *',
    });
    await repository.save(schedule);

    await repository.delete(schedule.id, workspaceId);

    await expect(repository.findById(schedule.id, workspaceId)).resolves.toBeNull();
  });

  it('counts schedules scoped to the workspace', async () => {
    const before = await repository.countByWorkspace(workspaceId);
    const workflowId = await createTestWorkflow(workspaceId);
    await repository.save(
      Schedule.create({
        workflowId: WorkflowId.create(workflowId),
        workspaceId,
        cronExpression: '0 0 * * *',
      }),
    );

    await expect(repository.countByWorkspace(workspaceId)).resolves.toBe(before + 1);
  });

  it('cascades: deleting the parent Workflow row also deletes its Schedule row', async () => {
    const workflowId = await createTestWorkflow(workspaceId);
    const schedule = Schedule.create({
      workflowId: WorkflowId.create(workflowId),
      workspaceId,
      cronExpression: '0 0 * * *',
    });
    await repository.save(schedule);
    await expect(repository.findById(schedule.id, workspaceId)).resolves.not.toBeNull();

    await prisma.workflow.delete({ where: { id: workflowId } });
    // Already deleted via cascade — remove from the cleanup list so afterAll
    // doesn't try to delete it again.
    const index = createdWorkflowIds.indexOf(workflowId);
    if (index >= 0) {
      createdWorkflowIds.splice(index, 1);
    }

    await expect(repository.findById(schedule.id, workspaceId)).resolves.toBeNull();
  });
});
