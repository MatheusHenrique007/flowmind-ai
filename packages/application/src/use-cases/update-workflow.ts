import { Workflow, type WorkflowId } from '@flowmind/domain';

import { WorkflowNotFoundError } from '../errors/workflow-not-found-error.js';
import type { WorkflowRepository } from '../ports/workflow-repository.js';

import { buildWorkflowSteps } from './build-workflow-steps.js';
import type { WorkflowInput } from './workflow-input.js';

/**
 * Replaces an existing Workflow's definition. Same validation path as
 * CreateWorkflow (Workflow.create()); the only extra rule here is that the
 * workflow must already exist.
 */
export class UpdateWorkflow {
  constructor(private readonly workflowRepository: WorkflowRepository) {}

  async execute(workflowId: WorkflowId, input: WorkflowInput): Promise<Workflow> {
    const existing = await this.workflowRepository.findById(workflowId);
    if (!existing) {
      throw new WorkflowNotFoundError(workflowId);
    }

    const workflow = Workflow.create({
      id: workflowId,
      name: input.name,
      steps: buildWorkflowSteps(input.steps),
    });

    await this.workflowRepository.save(workflow);

    return workflow;
  }
}
