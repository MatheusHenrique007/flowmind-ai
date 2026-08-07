import type { Workflow, WorkflowId } from '@flowmind/domain';

export interface WorkflowRepository {
  findById(id: WorkflowId): Promise<Workflow | null>;
}
