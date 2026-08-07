import { Queue, type ConnectionOptions } from 'bullmq';

import { BullMQWorkflowQueue } from './bullmq-workflow-queue.js';
import {
  WORKFLOW_EXECUTION_QUEUE_NAME,
  type WorkflowExecutionJobData,
} from './workflow-execution-job.js';

/**
 * The only factory allowed to construct a BullMQ Queue — Presentation calls
 * this instead of importing bullmq directly.
 */
export function createWorkflowQueue(connection: ConnectionOptions): BullMQWorkflowQueue {
  const queue = new Queue<WorkflowExecutionJobData>(WORKFLOW_EXECUTION_QUEUE_NAME, { connection });
  return new BullMQWorkflowQueue(queue);
}
