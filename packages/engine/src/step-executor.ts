import type { ExecutionContext, WorkflowStep } from '@flowmind/domain';

/**
 * Result of one executor running one step: the (possibly updated)
 * ExecutionContext plus the raw output for that step. The Engine — not the
 * executor — turns this into a WorkflowStepResult (it's the one place that
 * knows about timestamps, via the Clock port).
 *
 * Executors only ever receive a `WorkflowStep`, never the full `Workflow` —
 * there is no way for an executor to read or mutate the workflow definition,
 * only to evolve the ExecutionContext.
 */
export interface StepExecutionOutcome {
  readonly context: ExecutionContext;
  readonly output: unknown;
}

/**
 * Implemented by TriggerExecutor, AIExecutor, DestinationExecutor. Throws
 * StepExecutionError on failure — never a bare Error.
 */
export interface StepExecutor {
  execute(step: WorkflowStep, context: ExecutionContext): Promise<StepExecutionOutcome>;
}
