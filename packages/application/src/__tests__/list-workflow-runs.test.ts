import {
  DestinationKind,
  ExecutionContext,
  Provider,
  Workflow,
  WorkflowStep,
  WorkspaceId,
} from '@flowmind/domain';
import { describe, expect, it } from 'vitest';

import { ExecuteWorkflow } from '../use-cases/execute-workflow.js';
import { ListWorkflowRuns } from '../use-cases/list-workflow-runs.js';

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

describe('ListWorkflowRuns', () => {
  it('returns an empty list when no runs have been saved', async () => {
    const useCase = new ListWorkflowRuns(
      new FakeWorkflowRunRepository(),
      new FakeWorkflowRepository(),
    );
    await expect(useCase.execute(workspaceId)).resolves.toEqual([]);
  });

  it('returns a view for every run that was executed', async () => {
    const workflowRepository = new FakeWorkflowRepository();
    const workflowRunRepository = new FakeWorkflowRunRepository();
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
    await executeWorkflow.execute(workspaceId, workflow.id, { text: 'hi' });

    const listWorkflowRuns = new ListWorkflowRuns(workflowRunRepository, workflowRepository);
    const views = await listWorkflowRuns.execute(workspaceId);

    expect(views).toHaveLength(1);
    expect(views[0]?.workflowId).toBe(workflow.id.value);
    expect(views[0]?.workflowName).toBe('Webhook to Slack');
  });

  it('resolves distinct names for runs spanning multiple workflows', async () => {
    const workflowRepository = new FakeWorkflowRepository();
    const workflowRunRepository = new FakeWorkflowRunRepository();
    const workflowOne = buildWorkflow();
    const workflowTwo = Workflow.create({
      name: 'Second workflow',
      steps: workflowOne.steps,
      workspaceId,
    });
    workflowRepository.seed(workflowOne);
    workflowRepository.seed(workflowTwo);
    const engine = new FakeWorkflowEngine();
    engine.willReturn({
      success: true,
      context: ExecutionContext.create({ text: 'hi' }),
      stepResults: [],
      stepsExecuted: 3,
    });
    const executeWorkflow = new ExecuteWorkflow(workflowRepository, workflowRunRepository, engine);
    await executeWorkflow.execute(workspaceId, workflowOne.id, { text: 'hi' });
    await executeWorkflow.execute(workspaceId, workflowTwo.id, { text: 'hi' });

    const listWorkflowRuns = new ListWorkflowRuns(workflowRunRepository, workflowRepository);
    const views = await listWorkflowRuns.execute(workspaceId);

    expect(views).toHaveLength(2);
    const byId = new Map(views.map((v) => [v.workflowId, v.workflowName]));
    expect(byId.get(workflowOne.id.value)).toBe('Webhook to Slack');
    expect(byId.get(workflowTwo.id.value)).toBe('Second workflow');
  });
});
