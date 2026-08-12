import { Schedule, ScheduleId, WorkflowId, WorkspaceId } from '@flowmind/domain';
import { describe, expect, it } from 'vitest';

import { ScheduleNotFoundError } from '../errors/schedule-not-found-error.js';
import { DeleteSchedule } from '../use-cases/delete-schedule.js';

import { FakeScheduleQueue } from './fakes/fake-schedule-queue.js';
import { FakeScheduleRepository } from './fakes/fake-schedule-repository.js';

const workspaceId = WorkspaceId.generate();

function seedSchedule(repository: FakeScheduleRepository, ws = workspaceId) {
  const schedule = Schedule.create({
    workflowId: WorkflowId.generate(),
    workspaceId: ws,
    cronExpression: '* * * * *',
  });
  repository.seed(schedule);
  return schedule;
}

describe('DeleteSchedule', () => {
  it('unregisters from the queue then deletes the Postgres row', async () => {
    const repository = new FakeScheduleRepository();
    const queue = new FakeScheduleQueue();
    const schedule = seedSchedule(repository);
    await queue.register(schedule);

    await new DeleteSchedule(repository, queue).execute(workspaceId, schedule.id);

    await expect(repository.findById(schedule.id, workspaceId)).resolves.toBeNull();
    expect(queue.registered.has(schedule.id.value)).toBe(false);
  });

  it('throws ScheduleNotFoundError for a cross-tenant schedule', async () => {
    const repository = new FakeScheduleRepository();
    const queue = new FakeScheduleQueue();
    const otherWorkspaceId = WorkspaceId.generate();
    const schedule = seedSchedule(repository, otherWorkspaceId);

    await expect(
      new DeleteSchedule(repository, queue).execute(workspaceId, schedule.id),
    ).rejects.toThrow(ScheduleNotFoundError);
  });

  it('throws ScheduleNotFoundError for a nonexistent schedule', async () => {
    const repository = new FakeScheduleRepository();
    const queue = new FakeScheduleQueue();

    await expect(
      new DeleteSchedule(repository, queue).execute(workspaceId, ScheduleId.generate()),
    ).rejects.toThrow();
  });

  it('does not touch the repository when queue unregistration fails, and propagates the error', async () => {
    const repository = new FakeScheduleRepository();
    const queue = new FakeScheduleQueue();
    const schedule = seedSchedule(repository);
    await queue.register(schedule);
    queue.shouldFailUnregister = true;

    await expect(
      new DeleteSchedule(repository, queue).execute(workspaceId, schedule.id),
    ).rejects.toThrow('simulated queue unregistration failure');

    await expect(repository.findById(schedule.id, workspaceId)).resolves.not.toBeNull();
  });
});
