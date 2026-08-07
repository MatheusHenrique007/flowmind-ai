import type { RunStatus, StepResultStatus } from '@flowmind/domain';

/**
 * Read-only projection of a WorkflowRun for history/display purposes.
 * Deliberately not the domain WorkflowRun: reads don't need — and
 * shouldn't require going through — the state-machine transitions that
 * exist to protect writes. Assembled directly from storage by the
 * repository, never reconstructed into a live domain entity.
 */
export interface WorkflowStepResultView {
  readonly stepId: string;
  readonly status: StepResultStatus;
  readonly output?: unknown;
  readonly error?: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly durationMs: number;
}

export interface WorkflowRunView {
  readonly id: string;
  readonly workflowId: string;
  readonly status: RunStatus;
  readonly startedAt?: Date;
  readonly finishedAt?: Date;
  readonly stepResults: readonly WorkflowStepResultView[];
}
