import { describe, expect, it } from 'vitest';

import { WorkflowRun } from '../entities/workflow-run.js';
import { WorkflowStepResult } from '../entities/workflow-step-result.js';
import { RunStatus } from '../enums/run-status.js';
import { StepResultStatus } from '../enums/step-result-status.js';
import { InvalidWorkflowRunTransitionError } from '../errors/invalid-workflow-run-transition-error.js';
import { WorkflowRunAlreadyFinishedError } from '../errors/workflow-run-already-finished-error.js';
import { WorkflowId } from '../value-objects/workflow-id.js';
import { WorkflowStepId } from '../value-objects/workflow-step-id.js';
import { WorkspaceId } from '../value-objects/workspace-id.js';

function newRun(): WorkflowRun {
  return WorkflowRun.create({
    workflowId: WorkflowId.generate(),
    workspaceId: WorkspaceId.generate(),
  });
}

describe('WorkflowRun', () => {
  it('starts in PENDING status', () => {
    const run = newRun();
    expect(run.status).toBe(RunStatus.PENDING);
  });

  it('transitions PENDING -> RUNNING -> SUCCEEDED without throwing', () => {
    const run = newRun();
    run.start();
    expect(run.status).toBe(RunStatus.RUNNING);
    run.complete();
    expect(run.status).toBe(RunStatus.SUCCEEDED);
    expect(run.finishedAt).toBeInstanceOf(Date);
  });

  it('transitions PENDING -> RUNNING -> FAILED without throwing', () => {
    const run = newRun();
    run.start();
    run.fail();
    expect(run.status).toBe(RunStatus.FAILED);
  });

  it('cannot be completed twice', () => {
    const run = newRun();
    run.start();
    run.complete();
    expect(() => run.complete()).toThrow(WorkflowRunAlreadyFinishedError);
  });

  it('cannot be failed after already succeeding', () => {
    const run = newRun();
    run.start();
    run.complete();
    expect(() => run.fail()).toThrow(WorkflowRunAlreadyFinishedError);
  });

  it('cannot be failed twice', () => {
    const run = newRun();
    run.start();
    run.fail();
    expect(() => run.fail()).toThrow(WorkflowRunAlreadyFinishedError);
  });

  it('cannot complete before starting', () => {
    const run = newRun();
    expect(() => run.complete()).toThrow(InvalidWorkflowRunTransitionError);
  });

  it('cannot start twice', () => {
    const run = newRun();
    run.start();
    expect(() => run.start()).toThrow(InvalidWorkflowRunTransitionError);
  });

  it('can be cancelled directly from PENDING', () => {
    const run = newRun();
    run.cancel();
    expect(run.status).toBe(RunStatus.CANCELLED);
  });

  it('can be cancelled from RUNNING', () => {
    const run = newRun();
    run.start();
    run.cancel();
    expect(run.status).toBe(RunStatus.CANCELLED);
  });

  it('cannot be cancelled after already terminal', () => {
    const run = newRun();
    run.start();
    run.complete();
    expect(() => run.cancel()).toThrow(WorkflowRunAlreadyFinishedError);
  });

  it('records step results only while RUNNING', () => {
    const run = newRun();
    const result = WorkflowStepResult.succeeded({
      stepId: WorkflowStepId.generate(),
      output: 'ok',
      startedAt: new Date('2026-01-01T00:00:00Z'),
      finishedAt: new Date('2026-01-01T00:00:01Z'),
    });

    expect(() => run.recordStepResult(result)).toThrow(InvalidWorkflowRunTransitionError);

    run.start();
    run.recordStepResult(result);
    expect(run.stepResults).toHaveLength(1);
    expect(run.stepResults[0]?.status).toBe(StepResultStatus.SUCCEEDED);
  });
});
