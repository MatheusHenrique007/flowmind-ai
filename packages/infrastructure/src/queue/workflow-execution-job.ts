export const WORKFLOW_EXECUTION_QUEUE_NAME = 'workflow-execution';

export interface WorkflowExecutionJobData {
  workflowId: string;
  /**
   * Captured from the authenticated session at enqueue time. The Worker runs
   * outside any HTTP request, so this is its only source of tenant scope — it
   * is never re-derived from the job payload or from the workflow row.
   */
  workspaceId: string;
  payload: unknown;
  /**
   * Present only on jobs produced by a recurring Schedule's job scheduler
   * (BullMQScheduleQueue); absent on one-shot webhook enqueues. Purely
   * informational for now — the Worker (start-workflow-worker.ts) ignores it,
   * it exists so a future release can distinguish scheduled from webhook runs
   * without another migration to this job payload shape.
   */
  scheduleId?: string;
}
