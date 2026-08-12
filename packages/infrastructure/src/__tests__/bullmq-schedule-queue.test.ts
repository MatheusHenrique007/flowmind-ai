import { ScheduleId, WorkflowId, Schedule, WorkspaceId } from '@flowmind/domain';
import type { Queue } from 'bullmq';
import { afterAll, describe, expect, it } from 'vitest';

import { BullMQScheduleQueue } from '../queue/bullmq-schedule-queue.js';
import { createRedisConnection } from '../queue/create-redis-connection.js';
import { createWorkflowExecutionQueue } from '../queue/create-workflow-queue.js';
import type { WorkflowExecutionJobData } from '../queue/workflow-execution-job.js';

/**
 * Real integration test against Redis — not mocked. Skips gracefully without
 * REDIS_URL, matching this codebase's DATABASE_URL skip-if convention for
 * Postgres integration suites.
 */
describe.skipIf(!process.env.REDIS_URL)('BullMQScheduleQueue', () => {
  const connection = createRedisConnection(process.env.REDIS_URL ?? '');
  const queue: Queue<WorkflowExecutionJobData> = createWorkflowExecutionQueue(connection);
  const scheduleQueue = new BullMQScheduleQueue(queue);

  afterAll(async () => {
    await queue.close();
    connection.disconnect();
  });

  function buildSchedule(): Schedule {
    return Schedule.create({
      id: ScheduleId.generate(),
      workflowId: WorkflowId.generate(),
      workspaceId: WorkspaceId.generate(),
      cronExpression: '0 0 * * *',
    });
  }

  it('registers a job scheduler visible via getJobSchedulers, then unregisters it', async () => {
    const schedule = buildSchedule();

    await scheduleQueue.register(schedule);
    const schedulers = await queue.getJobSchedulers();
    expect(schedulers.some((s) => s.key === schedule.id.value)).toBe(true);

    await scheduleQueue.unregister(schedule.id);
    const after = await queue.getJobSchedulers();
    expect(after.some((s) => s.key === schedule.id.value)).toBe(false);
  });

  it('does not throw when unregistering an id that was never registered (safe no-op)', async () => {
    await expect(scheduleQueue.unregister(ScheduleId.generate())).resolves.not.toThrow();
  });

  it('carries workflowId/workspaceId/scheduleId in the job template data', async () => {
    const schedule = buildSchedule();
    await scheduleQueue.register(schedule);

    const scheduler = await queue.getJobScheduler(schedule.id.value);
    expect(scheduler?.template?.data).toMatchObject({
      workflowId: schedule.workflowId.value,
      workspaceId: schedule.workspaceId.value,
      scheduleId: schedule.id.value,
    });

    await scheduleQueue.unregister(schedule.id);
  });
});
