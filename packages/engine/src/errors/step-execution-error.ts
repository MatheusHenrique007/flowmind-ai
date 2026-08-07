import type { WorkflowStepId } from '@flowmind/domain';

/**
 * The single error contract for a failed step execution. Every executor
 * throws this — and only this — when a step fails, so the Engine's loop
 * never has to guess what kind of error it caught.
 */
export class StepExecutionError extends Error {
  readonly stepId: WorkflowStepId;

  constructor(stepId: WorkflowStepId, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'StepExecutionError';
    this.stepId = stepId;
  }
}
