import {
  DestinationKind,
  ExecutionContext,
  Provider,
  RunStatus,
  StepResultStatus,
  Workflow,
  WorkflowStep,
  WorkflowStepId,
  WorkflowStepResult,
} from '@flowmind/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import { WorkflowNotFoundError } from '../errors/workflow-not-found-error.js';
import { ExecuteWorkflow } from '../use-cases/execute-workflow.js';

import { FakeWorkflowEngine } from './fakes/fake-workflow-engine.js';
import { FakeWorkflowRepository } from './fakes/fake-workflow-repository.js';
import { FakeWorkflowRunRepository } from './fakes/fake-workflow-run-repository.js';

function buildWorkflow(): Workflow {
  return Workflow.create({
    name: 'Webhook to Slack',
    steps: [
      WorkflowStep.trigger({ kind: 'webhook' }),
      WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
      WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
    ],
  });
}

describe('ExecuteWorkflow', () => {
  let workflowRepository: FakeWorkflowRepository;
  let workflowRunRepository: FakeWorkflowRunRepository;
  let engine: FakeWorkflowEngine;
  let useCase: ExecuteWorkflow;

  beforeEach(() => {
    workflowRepository = new FakeWorkflowRepository();
    workflowRunRepository = new FakeWorkflowRunRepository();
    engine = new FakeWorkflowEngine();
    useCase = new ExecuteWorkflow(workflowRepository, workflowRunRepository, engine);
  });

  it('throws WorkflowNotFoundError when the workflow does not exist', async () => {
    await expect(useCase.execute(buildWorkflow().id, { text: 'hi' })).rejects.toThrow(
      WorkflowNotFoundError,
    );
  });

  it('never calls the engine when the workflow is not found', async () => {
    await expect(useCase.execute(buildWorkflow().id, { text: 'hi' })).rejects.toThrow();
    expect(engine.lastCall).toBeUndefined();
  });

  it('persists the run as PENDING, then RUNNING, then SUCCEEDED — never skipping a step', async () => {
    const workflow = buildWorkflow();
    workflowRepository.seed(workflow);
    engine.willReturn({
      success: true,
      context: ExecutionContext.create({ text: 'hi' }),
      stepResults: [],
      stepsExecuted: 3,
    });

    const run = await useCase.execute(workflow.id, { text: 'hi' });

    expect(workflowRunRepository.savedStatusesInOrder).toEqual([
      RunStatus.PENDING,
      RunStatus.RUNNING,
      RunStatus.SUCCEEDED,
    ]);
    expect(run.status).toBe(RunStatus.SUCCEEDED);
  });

  it('marks the run FAILED when the engine reports failure', async () => {
    const workflow = buildWorkflow();
    workflowRepository.seed(workflow);
    engine.willReturn({
      success: false,
      context: ExecutionContext.create({ text: 'hi' }),
      stepResults: [],
      stepsExecuted: 3,
    });

    const run = await useCase.execute(workflow.id, { text: 'hi' });

    expect(run.status).toBe(RunStatus.FAILED);
    expect(workflowRunRepository.savedStatusesInOrder).toEqual([
      RunStatus.PENDING,
      RunStatus.RUNNING,
      RunStatus.FAILED,
    ]);
  });

  it('records every step result the engine returns onto the run', async () => {
    const workflow = buildWorkflow();
    workflowRepository.seed(workflow);
    const stepResult = WorkflowStepResult.succeeded({
      stepId: WorkflowStepId.generate(),
      output: 'a summary',
      startedAt: new Date('2026-01-01T00:00:00Z'),
      finishedAt: new Date('2026-01-01T00:00:01Z'),
    });
    engine.willReturn({
      success: true,
      context: ExecutionContext.create({ text: 'hi' }),
      stepResults: [stepResult],
      stepsExecuted: 1,
    });

    const run = await useCase.execute(workflow.id, { text: 'hi' });

    expect(run.stepResults).toHaveLength(1);
    expect(run.stepResults[0]?.status).toBe(StepResultStatus.SUCCEEDED);
  });

  it('passes the workflow and a context wrapping the input to the engine', async () => {
    const workflow = buildWorkflow();
    workflowRepository.seed(workflow);
    engine.willReturn({
      success: true,
      context: ExecutionContext.create({ text: 'hi' }),
      stepResults: [],
      stepsExecuted: 3,
    });

    await useCase.execute(workflow.id, { text: 'hi' });

    expect(engine.lastCall?.workflow).toBe(workflow);
    expect(engine.lastCall?.context.get('input')).toEqual({ text: 'hi' });
  });

  it('propagates an error thrown by the engine without swallowing it', async () => {
    const workflow = buildWorkflow();
    workflowRepository.seed(workflow);
    engine.willThrow(new Error('Claude API unreachable'));

    await expect(useCase.execute(workflow.id, { text: 'hi' })).rejects.toThrow(
      'Claude API unreachable',
    );
  });
});
