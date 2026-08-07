import { StepResultStatus } from '../enums/step-result-status.js';
import { InvalidStepConfigError } from '../errors/invalid-step-config-error.js';
import type { WorkflowStepId } from '../value-objects/workflow-step-id.js';

/**
 * The outcome of one WorkflowStep within a WorkflowRun. `durationMs` is
 * derived from `startedAt`/`finishedAt` rather than accepted as an
 * independent field, so it can never drift out of sync with the timestamps
 * it's supposed to summarize.
 */
export class WorkflowStepResult {
  readonly stepId: WorkflowStepId;
  readonly status: StepResultStatus;
  readonly output?: unknown;
  readonly error?: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;

  private constructor(params: {
    stepId: WorkflowStepId;
    status: StepResultStatus;
    output?: unknown;
    error?: string;
    startedAt: Date;
    finishedAt: Date;
  }) {
    if (params.finishedAt.getTime() < params.startedAt.getTime()) {
      throw new InvalidStepConfigError('finishedAt cannot be before startedAt.');
    }
    this.stepId = params.stepId;
    this.status = params.status;
    this.output = params.output;
    this.error = params.error;
    this.startedAt = params.startedAt;
    this.finishedAt = params.finishedAt;
  }

  get durationMs(): number {
    return this.finishedAt.getTime() - this.startedAt.getTime();
  }

  static succeeded(params: {
    stepId: WorkflowStepId;
    output: unknown;
    startedAt: Date;
    finishedAt: Date;
  }): WorkflowStepResult {
    return new WorkflowStepResult({ ...params, status: StepResultStatus.SUCCEEDED });
  }

  static failed(params: {
    stepId: WorkflowStepId;
    error: string;
    startedAt: Date;
    finishedAt: Date;
  }): WorkflowStepResult {
    return new WorkflowStepResult({ ...params, status: StepResultStatus.FAILED });
  }
}
