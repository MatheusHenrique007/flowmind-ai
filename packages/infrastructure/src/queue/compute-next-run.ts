import type { Queue } from 'bullmq';

import type { WorkflowExecutionJobData } from './workflow-execution-job.js';

/**
 * Reads the next scheduled execution time for a registered Schedule directly
 * from BullMQ's job scheduler state (`JobSchedulerJson.next`, a Unix ms
 * timestamp already computed by BullMQ from the cron pattern) — no
 * cron-parser dependency needed, BullMQ already resolves this internally and
 * exposes it. Belongs in Infrastructure, not Domain or Application: it is a
 * read against the queue backend's live state, not a pure function of the
 * cron string alone (see docs/adr/0006-schedule-execution-strategy.md).
 *
 * Returns null if the schedule isn't currently registered (e.g. it was just
 * deleted, or registration failed).
 */
export async function computeNextRun(
  queue: Queue<WorkflowExecutionJobData>,
  scheduleId: string,
): Promise<Date | null> {
  const scheduler = await queue.getJobScheduler(scheduleId);
  if (!scheduler || scheduler.next === undefined) {
    return null;
  }
  return new Date(scheduler.next);
}
