export const WORKFLOW_EXECUTION_QUEUE_NAME = 'workflow-execution';

export interface WorkflowExecutionJobData {
  workflowId: string;
  payload: unknown;
}
