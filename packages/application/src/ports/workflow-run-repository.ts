import type { WorkflowRun } from '@flowmind/domain';

export interface WorkflowRunRepository {
  save(run: WorkflowRun): Promise<void>;
}
