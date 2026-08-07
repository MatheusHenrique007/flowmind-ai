import { ExecutionContext, Provider, WorkflowStep } from '@flowmind/domain';
import { describe, expect, it } from 'vitest';

import { StepExecutionError } from '../errors/step-execution-error.js';
import { AIExecutor } from '../executors/ai-executor.js';

import { FakeAIProvider } from './fakes/fake-ai-provider.js';

describe('AIExecutor', () => {
  it('calls the resolved provider and stores its response under "aiOutput"', async () => {
    const provider = new FakeAIProvider();
    provider.willReturn({ content: 'a short summary', model: 'claude-3-5-sonnet' });
    const executor = new AIExecutor(() => provider);
    const step = WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' });
    const context = ExecutionContext.create('raw ticket text');

    const outcome = await executor.execute(step, context);

    expect(outcome.output).toEqual({ content: 'a short summary', model: 'claude-3-5-sonnet' });
    expect(outcome.context.get('aiOutput')).toEqual({
      content: 'a short summary',
      model: 'claude-3-5-sonnet',
    });
    expect(provider.lastRequest?.messages).toEqual([
      { role: 'system', content: 'Summarize.' },
      { role: 'user', content: 'raw ticket text' },
    ]);
  });

  it('throws StepExecutionError with a clear message when no provider is registered', async () => {
    const executor = new AIExecutor(() => undefined);
    const step = WorkflowStep.ai({ provider: Provider.OPENAI, instruction: 'Classify.' });
    const context = ExecutionContext.create('raw text');

    await expect(executor.execute(step, context)).rejects.toThrow(
      /No AIProvider registered for provider "OPENAI"/,
    );
  });

  it('wraps a provider failure in StepExecutionError without losing the cause', async () => {
    const provider = new FakeAIProvider();
    const originalError = new Error('Claude API timed out');
    provider.willThrow(originalError);
    const executor = new AIExecutor(() => provider);
    const step = WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' });
    const context = ExecutionContext.create('raw text');

    const error = await executor.execute(step, context).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(StepExecutionError);
    expect((error as StepExecutionError).cause).toBe(originalError);
  });
});
