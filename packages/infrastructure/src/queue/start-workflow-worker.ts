import type { ExecuteWorkflow } from '@flowmind/application';
import { WorkflowId, WorkspaceId } from '@flowmind/domain';
import { Worker, type ConnectionOptions } from 'bullmq';

import {
  WORKFLOW_EXECUTION_QUEUE_NAME,
  type WorkflowExecutionJobData,
} from './workflow-execution-job.js';

/** Re-exported so Presentation never has to import bullmq for the type either. */
export type WorkflowWorker = Worker<WorkflowExecutionJobData>;

/**
 * Boots the BullMQ Worker that drains the workflow-execution queue. The job
 * handler calls only ExecuteWorkflow — never the Engine directly — matching
 * the same rule the Fastify route follows.
 */
export function startWorkflowWorker(params: {
  connection: ConnectionOptions;
  executeWorkflow: ExecuteWorkflow;
}): WorkflowWorker {
  return new Worker<WorkflowExecutionJobData>(
    WORKFLOW_EXECUTION_QUEUE_NAME,
    async (job) => {
      await params.executeWorkflow.execute(
        WorkspaceId.create(job.data.workspaceId),
        WorkflowId.create(job.data.workflowId),
        job.data.payload,
      );
    },
    { connection: params.connection },
  );
}
