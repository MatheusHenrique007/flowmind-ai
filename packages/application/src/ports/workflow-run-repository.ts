import type { WorkflowRun, WorkflowRunId, WorkspaceId } from '@flowmind/domain';

import type { WorkflowRunView } from './workflow-run-view.js';

export interface WorkflowRunRepository {
  /** The workspace is taken from the WorkflowRun itself, which always carries one. */
  save(run: WorkflowRun): Promise<void>;
  /** Returns null for a run owned by another workspace — same contract as WorkflowRepository.findById. */
  findViewById(id: WorkflowRunId, workspaceId: WorkspaceId): Promise<WorkflowRunView | null>;
  listViews(workspaceId: WorkspaceId): Promise<WorkflowRunView[]>;
}
