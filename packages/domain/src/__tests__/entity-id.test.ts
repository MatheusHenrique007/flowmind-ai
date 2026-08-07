import { describe, expect, it } from 'vitest';

import { InvalidIdError } from '../errors/invalid-id-error.js';
import { WorkflowId } from '../value-objects/workflow-id.js';
import { WorkflowRunId } from '../value-objects/workflow-run-id.js';

describe('EntityId (via WorkflowId/WorkflowRunId)', () => {
  it('rejects an empty string', () => {
    expect(() => WorkflowId.create('')).toThrow(InvalidIdError);
  });

  it('rejects a blank string', () => {
    expect(() => WorkflowId.create('   ')).toThrow(InvalidIdError);
  });

  it('accepts a non-empty string', () => {
    expect(WorkflowId.create('wf-123').value).toBe('wf-123');
  });

  it('generates a value when none is given', () => {
    expect(WorkflowId.generate().value.length).toBeGreaterThan(0);
  });

  it('considers two ids of the same type with the same value equal', () => {
    const a = WorkflowId.create('same');
    const b = WorkflowId.create('same');
    expect(a.equals(b)).toBe(true);
  });

  it('never considers a WorkflowId equal to a WorkflowRunId, even with the same value', () => {
    const workflowId = WorkflowId.create('shared-value');
    const runId = WorkflowRunId.create('shared-value');
    expect(workflowId.equals(runId)).toBe(false);
  });
});
