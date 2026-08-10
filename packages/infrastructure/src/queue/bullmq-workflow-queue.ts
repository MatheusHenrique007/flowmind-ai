import type { WorkflowQueue } from '@flowmind/application';
import type { WorkflowId, WorkspaceId } from '@flowmind/domain';
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

  async enqueue(workspaceId: WorkspaceId, workflowId: WorkflowId, payload: unknown): Promise<void> {
    await this.queue.add(WORKFLOW_EXECUTION_QUEUE_NAME, {
      workflowId: workflowId.value,
      workspaceId: workspaceId.value,
      payload,
    });
  }

  /** Connectivity probe for GET /health — not part of the WorkflowQueue port. */
  async ping(): Promise<'ok' | 'error'> {
    try {
      await this.queue.getJobCounts();
      return 'ok';
    } catch {
      return 'error';
    }
  }
}
