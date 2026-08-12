import type { WorkspaceId } from '@flowmind/domain';

import type { WorkflowRepository } from '../ports/workflow-repository.js';
import type { WorkflowRunRepository } from '../ports/workflow-run-repository.js';
import type { WorkflowRunView } from '../ports/workflow-run-view.js';

export class ListWorkflowRuns {
  constructor(
    private readonly workflowRunRepository: WorkflowRunRepository,
    private readonly workflowRepository: WorkflowRepository,
  ) {}

  /** Only ever returns runs belonging to `workspaceId`. */
  async execute(workspaceId: WorkspaceId): Promise<WorkflowRunView[]> {
    const [views, workflows] = await Promise.all([
      this.workflowRunRepository.listViews(workspaceId),
      this.workflowRepository.listByWorkspace(workspaceId),
    ]);
    const namesById = new Map(workflows.map((w) => [w.id.value, w.name]));
    return views.map((view) => ({ ...view, workflowName: namesById.get(view.workflowId) }));
  }
}
