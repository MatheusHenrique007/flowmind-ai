import { Workflow, type WorkflowId, type WorkspaceId } from '@flowmind/domain';

import { WorkflowNotFoundError } from '../errors/workflow-not-found-error.js';
import type { WorkflowRepository } from '../ports/workflow-repository.js';

import { buildWorkflowSteps } from './build-workflow-steps.js';
import type { WorkflowInput } from './workflow-input.js';

/**
 * Replaces an existing Workflow's definition. Same validation path as
 * CreateWorkflow (Workflow.create()); the only extra rule here is that the
 * workflow must already exist *in the caller's workspace* — the scoped
 * findById makes another workspace's workflow look nonexistent, so this
 * throws WorkflowNotFoundError (→ 404) rather than a distinguishable 403.
 */
export class UpdateWorkflow {
  constructor(private readonly workflowRepository: WorkflowRepository) {}

  async execute(
    workspaceId: WorkspaceId,
    workflowId: WorkflowId,
    input: WorkflowInput,
  ): Promise<Workflow> {
    const existing = await this.workflowRepository.findById(workflowId, workspaceId);
    if (!existing) {
      throw new WorkflowNotFoundError(workflowId);
    }

    const workflow = Workflow.create({
      id: workflowId,
      name: input.name,
      steps: buildWorkflowSteps(input.steps),
      // Taken from the loaded workflow, not the parameter: an update can never
      // move a workflow into a different workspace.
      workspaceId: existing.workspaceId,
    });

    await this.workflowRepository.save(workflow);

    return workflow;
  }
}
