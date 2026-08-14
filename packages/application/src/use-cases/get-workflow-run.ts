import { WorkflowId, type WorkflowRunId, type WorkspaceId } from '@flowmind/domain';

import { WorkflowRunNotFoundError } from '../errors/workflow-run-not-found-error.js';
import type { WorkflowRepository } from '../ports/workflow-repository.js';
import type { WorkflowRunRepository } from '../ports/workflow-run-repository.js';
import type { WorkflowRunView } from '../ports/workflow-run-view.js';

export class GetWorkflowRun {
  constructor(
    private readonly workflowRunRepository: WorkflowRunRepository,
    private readonly workflowRepository: WorkflowRepository,
  ) {}

  /** Another workspace's run reads as not found — 404, never 403 (ADR-0004). */
  async execute(workspaceId: WorkspaceId, workflowRunId: WorkflowRunId): Promise<WorkflowRunView> {
    const view = await this.workflowRunRepository.findViewById(workflowRunId, workspaceId);
    if (!view) {
      throw new WorkflowRunNotFoundError(workflowRunId);
    }
    const workflow = await this.workflowRepository.findById(
      WorkflowId.create(view.workflowId),
      workspaceId,
    );
    return workflow ? { ...view, workflowName: workflow.name } : view;
  }
}
