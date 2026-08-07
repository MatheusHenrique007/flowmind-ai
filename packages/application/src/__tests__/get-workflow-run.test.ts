import {
  DestinationKind,
  ExecutionContext,
  Provider,
  Workflow,
  WorkflowRunId,
  WorkflowStep,
} from '@flowmind/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import { WorkflowRunNotFoundError } from '../errors/workflow-run-not-found-error.js';
import { ExecuteWorkflow } from '../use-cases/execute-workflow.js';
import { GetWorkflowRun } from '../use-cases/get-workflow-run.js';

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

describe('GetWorkflowRun', () => {
  let workflowRunRepository: FakeWorkflowRunRepository;
  let getWorkflowRun: GetWorkflowRun;

  beforeEach(() => {
    workflowRunRepository = new FakeWorkflowRunRepository();
    getWorkflowRun = new GetWorkflowRun(workflowRunRepository);
  });

  it('throws WorkflowRunNotFoundError when no run exists with that id', async () => {
    await expect(getWorkflowRun.execute(WorkflowRunId.generate())).rejects.toThrow(
      WorkflowRunNotFoundError,
    );
  });

  it('returns the view for a run that was saved', async () => {
    const workflowRepository = new FakeWorkflowRepository();
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

    const run = await executeWorkflow.execute(workflow.id, { text: 'hi' });
    const view = await getWorkflowRun.execute(run.id);

    expect(view.id).toBe(run.id.value);
    expect(view.status).toBe(run.status);
  });
});
