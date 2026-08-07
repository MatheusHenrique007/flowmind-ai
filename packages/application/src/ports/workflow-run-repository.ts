import type { WorkflowRun, WorkflowRunId } from '@flowmind/domain';

import type { WorkflowRunView } from './workflow-run-view.js';

export interface WorkflowRunRepository {
  save(run: WorkflowRun): Promise<void>;
  findViewById(id: WorkflowRunId): Promise<WorkflowRunView | null>;
  listViews(): Promise<WorkflowRunView[]>;
}
