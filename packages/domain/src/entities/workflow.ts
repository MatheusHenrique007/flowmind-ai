import { StepType } from '../enums/step-type.js';
import { InvalidWorkflowDefinitionError } from '../errors/invalid-workflow-definition-error.js';
import { WorkflowId } from '../value-objects/workflow-id.js';
import type { WorkspaceId } from '../value-objects/workspace-id.js';

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
  /**
   * The owning tenant. Required since v0.4.0 — a Workflow with no Workspace
   * is not representable, which is what makes cross-tenant leakage a type
   * error rather than a forgotten filter (see ADR-0004).
   */
  readonly workspaceId: WorkspaceId;

  private constructor(
    id: WorkflowId,
    name: string,
    steps: readonly WorkflowStep[],
    workspaceId: WorkspaceId,
  ) {
    this.id = id;
    this.name = name;
    this.steps = steps;
    this.workspaceId = workspaceId;
  }

  static create(params: {
    id?: WorkflowId;
    name: string;
    steps: readonly WorkflowStep[];
    workspaceId: WorkspaceId;
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

    return new Workflow(params.id ?? WorkflowId.generate(), name, params.steps, params.workspaceId);
  }
}
