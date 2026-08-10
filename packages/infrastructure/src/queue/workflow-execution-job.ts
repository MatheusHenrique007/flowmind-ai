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
}
