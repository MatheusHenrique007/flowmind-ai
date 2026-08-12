import { Workflow, type WorkspaceId } from '@flowmind/domain';

import type { WorkflowRepository } from '../ports/workflow-repository.js';

import { buildWorkflowSteps } from './build-workflow-steps.js';
import type { WorkflowInput } from './workflow-input.js';

/**
 * Creates and persists a new Workflow in the caller's workspace. All
 * structural validation (at least one Trigger/AI/Destination, Trigger first,
 * ...) happens inside Workflow.create() — this use case adds no rules of its
 * own, it only maps input and calls save().
 *
 * `workspaceId` is a required parameter, never read from the input DTO: it
 * comes from the authenticated session, so a client cannot ask for a workflow
 * to be created in someone else's workspace.
 */
export class CreateWorkflow {
  constructor(private readonly workflowRepository: WorkflowRepository) {}

  async execute(workspaceId: WorkspaceId, input: WorkflowInput): Promise<Workflow> {
    const workflow = Workflow.create({
      name: input.name,
      steps: buildWorkflowSteps(input.steps),
      workspaceId,
    });

    await this.workflowRepository.save(workflow);

    return workflow;
  }
}
