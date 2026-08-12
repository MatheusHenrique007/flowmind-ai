import type { ScheduleQueue } from '@flowmind/application';
import type { Schedule, ScheduleId } from '@flowmind/domain';
import type { Queue } from 'bullmq';

import {
  WORKFLOW_EXECUTION_QUEUE_NAME,
  type WorkflowExecutionJobData,
} from './workflow-execution-job.js';

/**
 * The only place in the codebase allowed to import bullmq for Schedule
 * registration. Wraps the SAME Queue<WorkflowExecutionJobData> instance
 * BullMQWorkflowQueue wraps (constructed once by createWorkflowExecutionQueue)
 * — this is a second adapter over one queue, never a second queue. Uses
 * BullMQ's Job Scheduler API (upsertJobScheduler/removeJobScheduler), not the
 * deprecated `repeat` option on `.add()` (see ADR-0006).
 */
export class BullMQScheduleQueue implements ScheduleQueue {
  constructor(private readonly queue: Queue<WorkflowExecutionJobData>) {}

  async register(schedule: Schedule): Promise<void> {
    await this.queue.upsertJobScheduler(
      schedule.id.value,
      { pattern: schedule.cronExpression },
      {
        name: WORKFLOW_EXECUTION_QUEUE_NAME,
        data: {
          workflowId: schedule.workflowId.value,
          workspaceId: schedule.workspaceId.value,
          payload: {},
          scheduleId: schedule.id.value,
        },
      },
    );
  }

  async unregister(scheduleId: ScheduleId): Promise<void> {
    // removeJobScheduler on an already-removed id is a safe no-op — deleting
    // a Schedule whose registration already failed/vanished must not throw.
    await this.queue.removeJobScheduler(scheduleId.value);
  }
}
