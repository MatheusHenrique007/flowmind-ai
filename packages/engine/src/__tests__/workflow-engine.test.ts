import {
  DestinationKind,
  ExecutionContext,
  Provider,
  StepResultStatus,
  StepType,
  Workflow,
  WorkflowStep,
  WorkspaceId,
} from '@flowmind/domain';
import { describe, expect, it } from 'vitest';

import { AIExecutor } from '../executors/ai-executor.js';
import { DestinationExecutor } from '../executors/destination-executor.js';
import { TriggerExecutor } from '../executors/trigger-executor.js';
import { StepExecutorRegistry } from '../step-executor-registry.js';
import { Engine } from '../workflow-engine.js';

import { FakeAIProvider } from './fakes/fake-ai-provider.js';
import { FakeClock } from './fakes/fake-clock.js';
import { FakeDestination } from './fakes/fake-destination.js';

function buildWorkflow(): Workflow {
  return Workflow.create({
    name: 'Webhook to Slack',
    steps: [
      WorkflowStep.trigger({ kind: 'webhook' }),
      WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
      WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
    ],
    // The Engine is workspace-agnostic — it never reads workspaceId. This is
    // only here because Workflow.create() requires an owning workspace now.
    workspaceId: WorkspaceId.generate(),
  });
}

function buildRegistry(params: { aiProvider: FakeAIProvider; destination: FakeDestination }) {
  const registry = new StepExecutorRegistry();
  registry.register(StepType.TRIGGER, new TriggerExecutor());
  registry.register(StepType.AI, new AIExecutor(() => params.aiProvider));
  registry.register(StepType.DESTINATION, new DestinationExecutor(() => params.destination));
  return registry;
}

describe('Engine', () => {
  it('runs all three steps sequentially and reports success', async () => {
    const aiProvider = new FakeAIProvider();
    aiProvider.willReturn({ content: 'a short summary', model: 'claude-3-5-sonnet' });
    const destination = new FakeDestination();
    destination.willReturn({ delivered: true });

    const registry = buildRegistry({ aiProvider, destination });
    const engine = new Engine(registry, new FakeClock());
    const workflow = buildWorkflow();

    const result = await engine.execute(workflow, ExecutionContext.create('raw ticket text'));

    expect(result.success).toBe(true);
    expect(result.stepsExecuted).toBe(3);
    expect(result.failedAtStep).toBeUndefined();
    expect(result.stepResults).toHaveLength(3);
    expect(result.stepResults.every((r) => r.status === StepResultStatus.SUCCEEDED)).toBe(true);
    expect(result.context.get('destinationResult')).toEqual({ delivered: true });
  });

  it('assigns increasing timestamps to each step via the Clock', async () => {
    const aiProvider = new FakeAIProvider();
    aiProvider.willReturn({ content: 'summary', model: 'claude-3-5-sonnet' });
    const destination = new FakeDestination();
    destination.willReturn({ delivered: true });

    const registry = buildRegistry({ aiProvider, destination });
    const engine = new Engine(registry, new FakeClock());
    const workflow = buildWorkflow();

    const result = await engine.execute(workflow, ExecutionContext.create('raw text'));

    const [first, second, third] = result.stepResults;
    expect(first!.startedAt.getTime()).toBeLessThan(second!.startedAt.getTime());
    expect(second!.startedAt.getTime()).toBeLessThan(third!.startedAt.getTime());
  });

  it('stops at the failing step and never runs the ones after it', async () => {
    const aiProvider = new FakeAIProvider();
    aiProvider.willThrow(new Error('Claude API unreachable'));
    const destination = new FakeDestination();

    const registry = buildRegistry({ aiProvider, destination });
    const engine = new Engine(registry, new FakeClock());
    const workflow = buildWorkflow();

    const result = await engine.execute(workflow, ExecutionContext.create('raw text'));

    expect(result.success).toBe(false);
    expect(result.stepsExecuted).toBe(2);
    expect(result.failedAtStep).toBe(workflow.steps[1]!.id);
    expect(result.stepResults).toHaveLength(2);
    expect(result.stepResults[1]!.status).toBe(StepResultStatus.FAILED);
    expect(destination.lastPayload).toBeUndefined();
  });

  it('records a FAILED result with the StepExecutionError message when a step fails', async () => {
    const aiProvider = new FakeAIProvider();
    aiProvider.willThrow(new Error('boom'));
    const destination = new FakeDestination();

    const registry = buildRegistry({ aiProvider, destination });
    const engine = new Engine(registry, new FakeClock());
    const workflow = buildWorkflow();

    const result = await engine.execute(workflow, ExecutionContext.create('raw text'));

    expect(result.stepResults[1]!.error).toMatch(/AIProvider "CLAUDE" failed/);
  });

  it('routes each AI step to its own configured provider when a workflow mixes providers', async () => {
    const claudeProvider = new FakeAIProvider();
    claudeProvider.willReturn({ content: 'claude summary', model: 'claude-3-5-sonnet' });
    const openaiProvider = new FakeAIProvider();
    openaiProvider.willReturn({ content: 'openai summary', model: 'gpt-4o' });
    const destination = new FakeDestination();
    destination.willReturn({ delivered: true });

    const providersByType: Partial<Record<Provider, FakeAIProvider>> = {
      [Provider.CLAUDE]: claudeProvider,
      [Provider.OPENAI]: openaiProvider,
    };
    const registry = new StepExecutorRegistry();
    registry.register(StepType.TRIGGER, new TriggerExecutor());
    registry.register(StepType.AI, new AIExecutor((provider) => providersByType[provider]));
    registry.register(StepType.DESTINATION, new DestinationExecutor(() => destination));

    const workflow = Workflow.create({
      name: 'Multi-provider workflow',
      steps: [
        WorkflowStep.trigger({ kind: 'webhook' }),
        WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize with Claude.' }),
        WorkflowStep.ai({ provider: Provider.OPENAI, instruction: 'Summarize with OpenAI.' }),
        WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
      ],
      workspaceId: WorkspaceId.generate(),
    });
    const engine = new Engine(registry, new FakeClock());

    const result = await engine.execute(workflow, ExecutionContext.create('raw ticket text'));

    expect(result.success).toBe(true);
    expect(claudeProvider.lastRequest?.messages).toEqual([
      { role: 'system', content: 'Summarize with Claude.' },
      { role: 'user', content: 'raw ticket text' },
    ]);
    expect(openaiProvider.lastRequest?.messages).toEqual([
      { role: 'system', content: 'Summarize with OpenAI.' },
      { role: 'user', content: 'raw ticket text' },
    ]);
    expect(result.stepResults[2]!.status).toBe(StepResultStatus.SUCCEEDED);
  });
});
