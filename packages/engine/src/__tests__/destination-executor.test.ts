import { DestinationKind, ExecutionContext, WorkflowStep } from '@flowmind/domain';
import { describe, expect, it } from 'vitest';

import { StepExecutionError } from '../errors/step-execution-error.js';
import { DestinationExecutor } from '../executors/destination-executor.js';

import { FakeDestination } from './fakes/fake-destination.js';

describe('DestinationExecutor', () => {
  it('sends the AI output content to the resolved destination', async () => {
    const destination = new FakeDestination();
    destination.willReturn({ delivered: true });
    const executor = new DestinationExecutor(() => destination);
    const step = WorkflowStep.destination({
      destination: DestinationKind.SLACK,
      target: '#alerts',
    });
    const context = ExecutionContext.create('raw text').with('aiOutput', {
      content: 'a short summary',
      model: 'claude-3-5-sonnet',
    });

    const outcome = await executor.execute(step, context);

    expect(destination.lastPayload).toEqual({ target: '#alerts', content: 'a short summary' });
    expect(outcome.output).toEqual({ delivered: true });
  });

  it('falls back to the raw input when there is no AI output in the context', async () => {
    const destination = new FakeDestination();
    destination.willReturn({ delivered: true });
    const executor = new DestinationExecutor(() => destination);
    const step = WorkflowStep.destination({
      destination: DestinationKind.SLACK,
      target: '#alerts',
    });
    const context = ExecutionContext.create('raw text only');

    await executor.execute(step, context);

    expect(destination.lastPayload).toEqual({ target: '#alerts', content: 'raw text only' });
  });

  it('throws StepExecutionError with a clear message when no destination is registered', async () => {
    const executor = new DestinationExecutor(() => undefined);
    const step = WorkflowStep.destination({
      destination: DestinationKind.SLACK,
      target: '#alerts',
    });
    const context = ExecutionContext.create('raw text');

    await expect(executor.execute(step, context)).rejects.toThrow(
      /No Destination registered for destination "SLACK"/,
    );
  });

  it('wraps a destination failure in StepExecutionError without losing the cause', async () => {
    const destination = new FakeDestination();
    const originalError = new Error('Slack webhook returned 500');
    destination.willThrow(originalError);
    const executor = new DestinationExecutor(() => destination);
    const step = WorkflowStep.destination({
      destination: DestinationKind.SLACK,
      target: '#alerts',
    });
    const context = ExecutionContext.create('raw text');

    const error = await executor.execute(step, context).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(StepExecutionError);
    expect((error as StepExecutionError).cause).toBe(originalError);
  });
});
