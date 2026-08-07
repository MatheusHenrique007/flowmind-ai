import { ExecutionContext, WorkflowStep } from '@flowmind/domain';
import { describe, expect, it } from 'vitest';

import { TriggerExecutor } from '../executors/trigger-executor.js';

describe('TriggerExecutor', () => {
  it('passes through the input already present in the context', async () => {
    const executor = new TriggerExecutor();
    const step = WorkflowStep.trigger({ kind: 'webhook' });
    const context = ExecutionContext.create({ ticketId: '123' });

    const outcome = await executor.execute(step, context);

    expect(outcome.output).toEqual({ ticketId: '123' });
    expect(outcome.context).toBe(context);
  });
});
