import {
  DestinationKind,
  ExecutionContext,
  Provider,
  Workflow,
  WorkflowRunId,
  WorkflowStep,
  WorkspaceId,
} from '@flowmind/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import { WorkflowRunNotFoundError } from '../errors/workflow-run-not-found-error.js';
import { ExecuteWorkflow } from '../use-cases/execute-workflow.js';
import { GetWorkflowRun } from '../use-cases/get-workflow-run.js';

import { FakeWorkflowEngine } from './fakes/fake-workflow-engine.js';
import { FakeWorkflowRepository } from './fakes/fake-workflow-repository.js';
import { FakeWorkflowRunRepository } from './fakes/fake-workflow-run-repository.js';

const workspaceId = WorkspaceId.generate();

function buildWorkflow(): Workflow {
  return Workflow.create({
    name: 'Webhook to Slack',
    steps: [
      WorkflowStep.trigger({ kind: 'webhook' }),
      WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
      WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
    ],
    workspaceId,
  });
}

describe('GetWorkflowRun', () => {
  let workflowRunRepository: FakeWorkflowRunRepository;
  let getWorkflowRun: GetWorkflowRun;

  let workflowRepository: FakeWorkflowRepository;

  beforeEach(() => {
    workflowRunRepository = new FakeWorkflowRunRepository();
    workflowRepository = new FakeWorkflowRepository();
    getWorkflowRun = new GetWorkflowRun(workflowRunRepository, workflowRepository);
  });

  it('throws WorkflowRunNotFoundError when no run exists with that id', async () => {
    await expect(getWorkflowRun.execute(workspaceId, WorkflowRunId.generate())).rejects.toThrow(
      WorkflowRunNotFoundError,
    );
  });

  it('returns the view for a run that was saved', async () => {
    const workflow = buildWorkflow();
    workflowRepository.seed(workflow);
    const engine = new FakeWorkflowEngine();
    engine.willReturn({
      success: true,
      context: ExecutionContext.create({ text: 'hi' }),
      stepResults: [],
      stepsExecuted: 3,
    });
    const executeWorkflow = new ExecuteWorkflow(workflowRepository, workflowRunRepository, engine);

    const run = await executeWorkflow.execute(workspaceId, workflow.id, { text: 'hi' });
    const view = await getWorkflowRun.execute(workspaceId, run.id);

    expect(view.id).toBe(run.id.value);
    expect(view.status).toBe(run.status);
  });

  it('attaches the owning workflow’s name to the view', async () => {
    const workflow = buildWorkflow();
    workflowRepository.seed(workflow);
    const engine = new FakeWorkflowEngine();
    engine.willReturn({
      success: true,
      context: ExecutionContext.create({ text: 'hi' }),
      stepResults: [],
      stepsExecuted: 3,
    });
    const executeWorkflow = new ExecuteWorkflow(workflowRepository, workflowRunRepository, engine);

    const run = await executeWorkflow.execute(workspaceId, workflow.id, { text: 'hi' });
    const view = await getWorkflowRun.execute(workspaceId, run.id);

    expect(view.workflowName).toBe('Webhook to Slack');
  });

  it('leaves workflowName undefined when the owning workflow can no longer be found', async () => {
    const workflow = buildWorkflow();
    const otherWorkflowRepository = new FakeWorkflowRepository();
    // Note: workflow is NOT seeded into `workflowRepository` used by getWorkflowRun.
    const engine = new FakeWorkflowEngine();
    engine.willReturn({
      success: true,
      context: ExecutionContext.create({ text: 'hi' }),
      stepResults: [],
      stepsExecuted: 3,
    });
    otherWorkflowRepository.seed(workflow);
    const executeWorkflow = new ExecuteWorkflow(
      otherWorkflowRepository,
      workflowRunRepository,
      engine,
    );

    const run = await executeWorkflow.execute(workspaceId, workflow.id, { text: 'hi' });
    const view = await getWorkflowRun.execute(workspaceId, run.id);

    expect(view.workflowName).toBeUndefined();
  });
});
