import { Queue, type ConnectionOptions } from 'bullmq';

import { BullMQWorkflowQueue } from './bullmq-workflow-queue.js';
import {
  WORKFLOW_EXECUTION_QUEUE_NAME,
  type WorkflowExecutionJobData,
} from './workflow-execution-job.js';

/**
 * The only factory allowed to construct the BullMQ Queue backing workflow
 * execution — both one-shot webhook enqueues (BullMQWorkflowQueue) and
 * recurring Schedule registration (BullMQScheduleQueue) wrap this SAME
 * instance; there is exactly one Queue for this queue name, never two (see
 * docs/adr/0006-schedule-execution-strategy.md).
 */
export function createWorkflowExecutionQueue(
  connection: ConnectionOptions,
): Queue<WorkflowExecutionJobData> {
  return new Queue<WorkflowExecutionJobData>(WORKFLOW_EXECUTION_QUEUE_NAME, { connection });
}

/** Presentation calls this instead of importing bullmq directly. */
export function createWorkflowQueue(queue: Queue<WorkflowExecutionJobData>): BullMQWorkflowQueue {
  return new BullMQWorkflowQueue(queue);
}
