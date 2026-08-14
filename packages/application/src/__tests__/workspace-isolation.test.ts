import { DestinationKind, ExecutionContext, Provider, WorkspaceId } from '@flowmind/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import { WorkflowNotFoundError } from '../errors/workflow-not-found-error.js';
import { WorkflowRunNotFoundError } from '../errors/workflow-run-not-found-error.js';
import { CreateWorkflow } from '../use-cases/create-workflow.js';
import { ExecuteWorkflow } from '../use-cases/execute-workflow.js';
import { GetWorkflowRun } from '../use-cases/get-workflow-run.js';
import { ListWorkflowRuns } from '../use-cases/list-workflow-runs.js';
import { UpdateWorkflow } from '../use-cases/update-workflow.js';

import { FakeWorkflowEngine } from './fakes/fake-workflow-engine.js';
import { FakeWorkflowRepository } from './fakes/fake-workflow-repository.js';
import { FakeWorkflowRunRepository } from './fakes/fake-workflow-run-repository.js';

function validInput(name = 'Webhook to Slack') {
  return {
    name,
    steps: [
      { type: 'TRIGGER' as const, kind: 'webhook' as const },
      { type: 'AI' as const, provider: Provider.CLAUDE, instruction: 'Summarize.' },
      { type: 'DESTINATION' as const, destination: DestinationKind.SLACK, target: '#alerts' },
    ],
  };
}

/**
 * The isolation guarantee this release exists to prove: user A's workspace can
 * never read, modify, execute, or list anything belonging to workspace B — and
 * every failure looks like "not found", never like "forbidden" (ADR-0004: a 403
 * would confirm the resource exists and let ids be enumerated across tenants).
 */
describe('workspace isolation', () => {
  const workspaceA = WorkspaceId.generate();
  const workspaceB = WorkspaceId.generate();

  let workflows: FakeWorkflowRepository;
  let runs: FakeWorkflowRunRepository;
  let engine: FakeWorkflowEngine;
  let createWorkflow: CreateWorkflow;
  let updateWorkflow: UpdateWorkflow;
  let executeWorkflow: ExecuteWorkflow;
  let getWorkflowRun: GetWorkflowRun;
  let listWorkflowRuns: ListWorkflowRuns;

  beforeEach(() => {
    workflows = new FakeWorkflowRepository();
    runs = new FakeWorkflowRunRepository();
    engine = new FakeWorkflowEngine();
    engine.willReturn({
      success: true,
      context: ExecutionContext.create({ text: 'hi' }),
      stepResults: [],
      stepsExecuted: 3,
    });
    createWorkflow = new CreateWorkflow(workflows);
    updateWorkflow = new UpdateWorkflow(workflows);
    executeWorkflow = new ExecuteWorkflow(workflows, runs, engine);
    getWorkflowRun = new GetWorkflowRun(runs, workflows);
    listWorkflowRuns = new ListWorkflowRuns(runs, workflows);
  });

  it('a workflow is created in the caller-supplied workspace', async () => {
    const workflow = await createWorkflow.execute(workspaceA, validInput());
    expect(workflow.workspaceId.equals(workspaceA)).toBe(true);
  });

  it('user A CAN read its own workflow', async () => {
    const workflow = await createWorkflow.execute(workspaceA, validInput());

    await expect(workflows.findById(workflow.id, workspaceA)).resolves.not.toBeNull();
  });

  it('user A CANNOT read a workflow belonging to workspace B — null, not an error', async () => {
    const workflow = await createWorkflow.execute(workspaceB, validInput());

    await expect(workflows.findById(workflow.id, workspaceA)).resolves.toBeNull();
  });

  it('user A CANNOT modify a workflow belonging to workspace B — 404-shaped, not 403', async () => {
    const workflow = await createWorkflow.execute(workspaceB, validInput('B owns this'));

    await expect(
      updateWorkflow.execute(workspaceA, workflow.id, validInput('A tried to rename it')),
    ).rejects.toThrow(WorkflowNotFoundError);

    const untouched = await workflows.findById(workflow.id, workspaceB);
    expect(untouched?.name).toBe('B owns this');
  });

  it('user A CANNOT execute a workflow belonging to workspace B, and the engine is never reached', async () => {
    const workflow = await createWorkflow.execute(workspaceB, validInput());

    await expect(executeWorkflow.execute(workspaceA, workflow.id, { text: 'hi' })).rejects.toThrow(
      WorkflowNotFoundError,
    );
    expect(engine.lastCall).toBeUndefined();
  });

  it('user A CANNOT read a workflow run belonging to workspace B', async () => {
    const workflow = await createWorkflow.execute(workspaceB, validInput());
    const run = await executeWorkflow.execute(workspaceB, workflow.id, { text: 'hi' });

    await expect(getWorkflowRun.execute(workspaceA, run.id)).rejects.toThrow(
      WorkflowRunNotFoundError,
    );
    await expect(getWorkflowRun.execute(workspaceB, run.id)).resolves.toBeDefined();
  });

  it('listing runs shows only the caller workspace’s own runs', async () => {
    const workflowA = await createWorkflow.execute(workspaceA, validInput());
    const workflowB = await createWorkflow.execute(workspaceB, validInput());
    await executeWorkflow.execute(workspaceA, workflowA.id, { text: 'hi' });
    await executeWorkflow.execute(workspaceB, workflowB.id, { text: 'hi' });

    const viewsForA = await listWorkflowRuns.execute(workspaceA);
    const viewsForB = await listWorkflowRuns.execute(workspaceB);

    expect(viewsForA).toHaveLength(1);
    expect(viewsForA[0]?.workflowId).toBe(workflowA.id.value);
    expect(viewsForB).toHaveLength(1);
    expect(viewsForB[0]?.workflowId).toBe(workflowB.id.value);
  });

  it('a run created by an execution inherits the owning workflow’s workspace', async () => {
    const workflow = await createWorkflow.execute(workspaceB, validInput());
    const run = await executeWorkflow.execute(workspaceB, workflow.id, { text: 'hi' });

    expect(run.workspaceId.equals(workspaceB)).toBe(true);
  });

  it('an update cannot move a workflow into the caller’s workspace', async () => {
    const workflow = await createWorkflow.execute(workspaceA, validInput());

    const updated = await updateWorkflow.execute(workspaceA, workflow.id, validInput('renamed'));

    expect(updated.workspaceId.equals(workspaceA)).toBe(true);
    await expect(workflows.findById(workflow.id, workspaceB)).resolves.toBeNull();
  });
});
