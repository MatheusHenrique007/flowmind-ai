import type { Workflow, WorkflowId, WorkspaceId } from '@flowmind/domain';

import { WorkflowNotFoundError } from '../errors/workflow-not-found-error.js';
import type { WorkflowRepository } from '../ports/workflow-repository.js';

/**
 * Loads a single Workflow scoped to the caller's workspace. A workflow
 * belonging to another workspace looks identical to a nonexistent one — same
 * WorkflowNotFoundError (→ 404, never 403), same pattern as UpdateWorkflow.
 */
export class GetWorkflow {
  constructor(private readonly workflowRepository: WorkflowRepository) {}

  async execute(workspaceId: WorkspaceId, workflowId: WorkflowId): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(workflowId, workspaceId);
    if (!workflow) {
      throw new WorkflowNotFoundError(workflowId);
    }
    return workflow;
  }
}
