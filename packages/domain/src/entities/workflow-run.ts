import { RunStatus, TERMINAL_RUN_STATUSES } from '../enums/run-status.js';
import { InvalidWorkflowRunTransitionError } from '../errors/invalid-workflow-run-transition-error.js';
import { WorkflowRunAlreadyFinishedError } from '../errors/workflow-run-already-finished-error.js';
import type { WorkflowId } from '../value-objects/workflow-id.js';
import { WorkflowRunId } from '../value-objects/workflow-run-id.js';

import type { WorkflowStepResult } from './workflow-step-result.js';

/**
 * One execution instance of a Workflow. `status` only ever moves forward
 * through PENDING -> RUNNING -> a terminal status (SUCCEEDED, FAILED, or
 * CANCELLED); once terminal, no further transition is possible.
 */
export class WorkflowRun {
  readonly id: WorkflowRunId;
  readonly workflowId: WorkflowId;
  private _status: RunStatus;
  private _startedAt?: Date;
  private _finishedAt?: Date;
  private readonly _stepResults: WorkflowStepResult[] = [];

  private constructor(id: WorkflowRunId, workflowId: WorkflowId) {
    this.id = id;
    this.workflowId = workflowId;
    this._status = RunStatus.PENDING;
  }

  static create(params: { id?: WorkflowRunId; workflowId: WorkflowId }): WorkflowRun {
    return new WorkflowRun(params.id ?? WorkflowRunId.generate(), params.workflowId);
  }

  get status(): RunStatus {
    return this._status;
  }

  get startedAt(): Date | undefined {
    return this._startedAt;
  }

  get finishedAt(): Date | undefined {
    return this._finishedAt;
  }

  get stepResults(): readonly WorkflowStepResult[] {
    return this._stepResults;
  }

  start(): void {
    this.assertTransitionAllowed(RunStatus.RUNNING);
    this._status = RunStatus.RUNNING;
    this._startedAt = new Date();
  }

  recordStepResult(result: WorkflowStepResult): void {
    if (this._status !== RunStatus.RUNNING) {
      throw new InvalidWorkflowRunTransitionError(this._status, RunStatus.RUNNING);
    }
    this._stepResults.push(result);
  }

  complete(): void {
    this.assertTransitionAllowed(RunStatus.SUCCEEDED);
    this._status = RunStatus.SUCCEEDED;
    this._finishedAt = new Date();
  }

  fail(): void {
    this.assertTransitionAllowed(RunStatus.FAILED);
    this._status = RunStatus.FAILED;
    this._finishedAt = new Date();
  }

  cancel(): void {
    this.assertTransitionAllowed(RunStatus.CANCELLED);
    this._status = RunStatus.CANCELLED;
    this._finishedAt = new Date();
  }

  private static readonly ALLOWED_SOURCE_STATUSES: Readonly<
    Record<RunStatus, readonly RunStatus[]>
  > = {
    [RunStatus.PENDING]: [],
    [RunStatus.RUNNING]: [RunStatus.PENDING],
    [RunStatus.SUCCEEDED]: [RunStatus.RUNNING],
    [RunStatus.FAILED]: [RunStatus.RUNNING],
    [RunStatus.CANCELLED]: [RunStatus.PENDING, RunStatus.RUNNING],
  };

  private assertTransitionAllowed(to: RunStatus): void {
    if (TERMINAL_RUN_STATUSES.has(this._status)) {
      throw new WorkflowRunAlreadyFinishedError(this._status);
    }
    if (!WorkflowRun.ALLOWED_SOURCE_STATUSES[to].includes(this._status)) {
      throw new InvalidWorkflowRunTransitionError(this._status, to);
    }
  }
}
