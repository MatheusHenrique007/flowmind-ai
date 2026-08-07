import { describe, expect, it } from 'vitest';

import { InvalidExecutionContextError } from '../errors/invalid-execution-context-error.js';
import { ExecutionContext } from '../value-objects/execution-context.js';

describe('ExecutionContext', () => {
  it('rejects null input', () => {
    expect(() => ExecutionContext.create(null)).toThrow(InvalidExecutionContextError);
  });

  it('rejects undefined input', () => {
    expect(() => ExecutionContext.create(undefined)).toThrow(InvalidExecutionContextError);
  });

  it('stores the initial input under the "input" key', () => {
    const context = ExecutionContext.create({ ticketId: '123' });
    expect(context.get('input')).toEqual({ ticketId: '123' });
  });

  it('is immutable: with() returns a new instance and leaves the original untouched', () => {
    const original = ExecutionContext.create('raw payload');
    const updated = original.with('summary', 'a short summary');

    expect(original.has('summary')).toBe(false);
    expect(updated.get('summary')).toBe('a short summary');
    expect(updated).not.toBe(original);
  });

  it('accumulates keys across multiple with() calls without losing earlier ones', () => {
    const context = ExecutionContext.create('raw payload')
      .with('summary', 'short summary')
      .with('classification', 'urgent');

    expect(context.get('input')).toBe('raw payload');
    expect(context.get('summary')).toBe('short summary');
    expect(context.get('classification')).toBe('urgent');
  });
});
