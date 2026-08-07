import { StepType } from '../enums/step-type.js';
import { InvalidWorkflowDefinitionError } from '../errors/invalid-workflow-definition-error.js';
import { WorkflowId } from '../value-objects/workflow-id.js';

import type { WorkflowStep } from './workflow-step.js';

/**
 * Aggregate root for a workflow definition. Validates only generic,
 * release-independent rules — it has no notion of "Release v0.2.0 only
 * supports one AI step." A workflow needs at least one Trigger, at least one
 * AI step, and at least one Destination step, with a Trigger first; how many
 * of each and in what specific order beyond that is left open for future
 * releases to compose more elaborate workflows without ever changing this
 * class.
 */
export class Workflow {
  readonly id: WorkflowId;
  readonly name: string;
  readonly steps: readonly WorkflowStep[];

  private constructor(id: WorkflowId, name: string, steps: readonly WorkflowStep[]) {
    this.id = id;
    this.name = name;
    this.steps = steps;
  }

  static create(params: {
    id?: WorkflowId;
    name: string;
    steps: readonly WorkflowStep[];
  }): Workflow {
    const name = params.name.trim();
    if (name.length === 0) {
      throw new InvalidWorkflowDefinitionError('name must not be empty.');
    }

    if (params.steps.length === 0) {
      throw new InvalidWorkflowDefinitionError('a workflow must have at least one step.');
    }

    if (params.steps[0]?.type !== StepType.TRIGGER) {
      throw new InvalidWorkflowDefinitionError('the first step must be a Trigger step.');
    }

    for (const requiredType of [StepType.TRIGGER, StepType.AI, StepType.DESTINATION]) {
      if (!params.steps.some((step) => step.type === requiredType)) {
        throw new InvalidWorkflowDefinitionError(
          `a workflow must contain at least one ${requiredType} step.`,
        );
      }
    }

    return new Workflow(params.id ?? WorkflowId.generate(), name, params.steps);
  }
}
