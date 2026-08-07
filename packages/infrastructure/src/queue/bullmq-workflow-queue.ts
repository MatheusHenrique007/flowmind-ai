import type { WorkflowQueue } from '@flowmind/application';
import type { WorkflowId } from '@flowmind/domain';
import type { Queue } from 'bullmq';

import {
  WORKFLOW_EXECUTION_QUEUE_NAME,
  type WorkflowExecutionJobData,
} from './workflow-execution-job.js';

/**
 * The only place in the codebase allowed to import bullmq for enqueueing —
 * the Fastify route depends on the WorkflowQueue port, never on this class
 * or on bullmq directly.
 */
export class BullMQWorkflowQueue implements WorkflowQueue {
  constructor(private readonly queue: Queue<WorkflowExecutionJobData>) {}

  async enqueue(workflowId: WorkflowId, payload: unknown): Promise<void> {
    await this.queue.add(WORKFLOW_EXECUTION_QUEUE_NAME, { workflowId: workflowId.value, payload });
  }
}
