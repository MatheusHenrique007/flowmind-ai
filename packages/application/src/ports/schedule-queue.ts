import type { Schedule, ScheduleId } from '@flowmind/domain';

/**
 * Port the Application layer depends on to (un)register a recurring job with
 * the queueing backend (BullMQ Job Scheduler in Infrastructure) — never on
 * BullMQ directly. A separate port from WorkflowQueue: WorkflowQueue is a
 * one-shot enqueue for webhook-triggered executions, this is a recurring
 * registration with entirely different lifecycle semantics (see ADR-0006).
 */
export interface ScheduleQueue {
  /** `schedule` already carries workflowId/workspaceId/cronExpression. */
  register(schedule: Schedule): Promise<void>;
  unregister(scheduleId: ScheduleId): Promise<void>;
}
