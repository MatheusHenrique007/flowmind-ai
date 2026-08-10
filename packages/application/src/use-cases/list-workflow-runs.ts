import type { WorkspaceId } from '@flowmind/domain';

import type { WorkflowRunRepository } from '../ports/workflow-run-repository.js';
import type { WorkflowRunView } from '../ports/workflow-run-view.js';

export class ListWorkflowRuns {
  constructor(private readonly workflowRunRepository: WorkflowRunRepository) {}

  /** Only ever returns runs belonging to `workspaceId`. */
  async execute(workspaceId: WorkspaceId): Promise<WorkflowRunView[]> {
    return this.workflowRunRepository.listViews(workspaceId);
  }
}
