import type {
  Clock,
  WorkflowEngine as WorkflowEnginePort,
  WorkflowExecutionResult,
} from '@flowmind/application';
import {
  WorkflowStepResult,
  type ExecutionContext,
  type Workflow,
  type WorkflowStepId,
} from '@flowmind/domain';

import { StepExecutionError } from './errors/step-execution-error.js';
import type { StepExecutorRegistry } from './step-executor-registry.js';

/**
 * Concrete WorkflowEngine (implements the port from @flowmind/application).
 * Runs a Workflow's steps strictly sequentially — no Promise.all, no
 * concurrency — resolving each step's executor from the registry and
 * building each WorkflowStepResult itself (the one place that touches the
 * Clock port), so executors stay free of timestamp bookkeeping.
 */
export class Engine implements WorkflowEnginePort {
  constructor(
    private readonly registry: StepExecutorRegistry,
    private readonly clock: Clock,
  ) {}

  async execute(
    workflow: Workflow,
    initialContext: ExecutionContext,
  ): Promise<WorkflowExecutionResult> {
    let context = initialContext;
    const stepResults: WorkflowStepResult[] = [];
    let stepsExecuted = 0;
    let success = true;
    let failedAtStep: WorkflowStepId | undefined;

    for (const step of workflow.steps) {
      const executor = this.registry.resolve(step.type);
      const startedAt = this.clock.now();

      try {
        const outcome = await executor.execute(step, context);
        context = outcome.context;
        stepResults.push(
          WorkflowStepResult.succeeded({
            stepId: step.id,
            output: outcome.output,
            startedAt,
            finishedAt: this.clock.now(),
          }),
        );
        stepsExecuted += 1;
      } catch (error) {
        const message =
          error instanceof StepExecutionError ? error.message : 'Unexpected error executing step.';
        stepResults.push(
          WorkflowStepResult.failed({
            stepId: step.id,
            error: message,
            startedAt,
            finishedAt: this.clock.now(),
          }),
        );
        stepsExecuted += 1;
        failedAtStep = step.id;
        success = false;
        break;
      }
    }

    return { success, context, stepResults, stepsExecuted, failedAtStep };
  }
}
