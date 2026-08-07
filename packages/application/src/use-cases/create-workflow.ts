import { Workflow } from '@flowmind/domain';

import type { WorkflowRepository } from '../ports/workflow-repository.js';

import { buildWorkflowSteps } from './build-workflow-steps.js';
import type { WorkflowInput } from './workflow-input.js';

/**
 * Creates and persists a new Workflow. All structural validation (at least
 * one Trigger/AI/Destination, Trigger first, ...) happens inside
 * Workflow.create() — this use case adds no rules of its own, it only maps
 * input and calls save().
 */
export class CreateWorkflow {
  constructor(private readonly workflowRepository: WorkflowRepository) {}

  async execute(input: WorkflowInput): Promise<Workflow> {
    const workflow = Workflow.create({
      name: input.name,
      steps: buildWorkflowSteps(input.steps),
    });

    await this.workflowRepository.save(workflow);

    return workflow;
  }
}
