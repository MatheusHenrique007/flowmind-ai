import type { ExecutionContext, WorkflowStep } from '@flowmind/domain';

import { StepExecutionError } from '../errors/step-execution-error.js';
import type { StepExecutionOutcome, StepExecutor } from '../step-executor.js';

/**
 * The trigger has already fired by the time the Engine runs (it's what
 * created the WorkflowRun) — this executor just confirms the initial input
 * landed in the ExecutionContext, formalizing the trigger as a recorded step
 * rather than doing any real work.
 */
export class TriggerExecutor implements StepExecutor {
  async execute(step: WorkflowStep, context: ExecutionContext): Promise<StepExecutionOutcome> {
    if (!context.has('input')) {
      throw new StepExecutionError(
        step.id,
        'ExecutionContext is missing "input" for trigger step.',
      );
    }
    return { context, output: context.get('input') };
  }
}
