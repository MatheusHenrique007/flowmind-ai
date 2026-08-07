import { describe, expect, it } from 'vitest';

import { WorkflowStepResult } from '../entities/workflow-step-result.js';
import { StepResultStatus } from '../enums/step-result-status.js';
import { InvalidStepConfigError } from '../errors/invalid-step-config-error.js';
import { WorkflowStepId } from '../value-objects/workflow-step-id.js';

describe('WorkflowStepResult', () => {
  it('computes durationMs from startedAt and finishedAt', () => {
    const result = WorkflowStepResult.succeeded({
      stepId: WorkflowStepId.generate(),
      output: 'done',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      finishedAt: new Date('2026-01-01T00:00:01.300Z'),
    });

    expect(result.durationMs).toBe(1300);
    expect(result.status).toBe(StepResultStatus.SUCCEEDED);
  });

  it('records a failure with an error message', () => {
    const result = WorkflowStepResult.failed({
      stepId: WorkflowStepId.generate(),
      error: 'Claude API timed out',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      finishedAt: new Date('2026-01-01T00:00:00.210Z'),
    });

    expect(result.status).toBe(StepResultStatus.FAILED);
    expect(result.error).toBe('Claude API timed out');
    expect(result.durationMs).toBe(210);
  });

  it('rejects a finishedAt earlier than startedAt', () => {
    expect(() =>
      WorkflowStepResult.succeeded({
        stepId: WorkflowStepId.generate(),
        output: 'x',
        startedAt: new Date('2026-01-01T00:00:05.000Z'),
        finishedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toThrow(InvalidStepConfigError);
  });
});
