import type { WorkflowId, WorkspaceId } from '@flowmind/domain';

/**
 * Port the Presentation layer depends on to enqueue a workflow execution —
 * never on BullMQ directly. The concrete queue (BullMQ-backed) lives in
 * Infrastructure.
 *
 * The workspace travels with the job: the Worker runs outside any HTTP
 * request, so it has no session to derive one from and must be told which
 * tenant the execution belongs to at enqueue time.
 */
export interface WorkflowQueue {
  enqueue(workspaceId: WorkspaceId, workflowId: WorkflowId, payload: unknown): Promise<void>;
}
