import type { WorkflowId } from '@flowmind/domain';

/**
 * Port the Presentation layer depends on to enqueue a workflow execution —
 * never on BullMQ directly. The concrete queue (BullMQ-backed) lives in
 * Infrastructure.
 */
export interface WorkflowQueue {
  enqueue(workflowId: WorkflowId, payload: unknown): Promise<void>;
}
