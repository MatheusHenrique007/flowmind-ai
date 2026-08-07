import type { ExecutionContext, Workflow, WorkflowStepResult } from '@flowmind/domain';

/**
 * Explicit, typed result of running a Workflow — the Application layer never
 * has to guess the shape of what the Engine handed back.
 */
export interface WorkflowExecutionResult {
  readonly success: boolean;
  readonly context: ExecutionContext;
  readonly stepResults: readonly WorkflowStepResult[];
}

/**
 * Port the Application depends on to run a Workflow. The concrete Engine
 * (built against the AIProvider/Destination contracts, per ADR-0002) lives
 * outside this layer — Application only knows this interface.
 */
export interface WorkflowEngine {
  execute(workflow: Workflow, context: ExecutionContext): Promise<WorkflowExecutionResult>;
}
