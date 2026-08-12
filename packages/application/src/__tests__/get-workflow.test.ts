import {
  DestinationKind,
  Provider,
  Workflow,
  WorkflowId,
  WorkflowStep,
  WorkspaceId,
} from '@flowmind/domain';
import { describe, expect, it } from 'vitest';

import { WorkflowNotFoundError } from '../errors/workflow-not-found-error.js';
import { GetWorkflow } from '../use-cases/get-workflow.js';

import { FakeWorkflowRepository } from './fakes/fake-workflow-repository.js';

function seededWorkflow(workspaceId: WorkspaceId) {
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

describe('GetWorkflow', () => {
  it("finds a workflow belonging to the caller's workspace", async () => {
    const workspaceId = WorkspaceId.generate();
    const repository = new FakeWorkflowRepository();
    const workflow = seededWorkflow(workspaceId);
    repository.seed(workflow);

    const found = await new GetWorkflow(repository).execute(workspaceId, workflow.id);

    expect(found.id.equals(workflow.id)).toBe(true);
  });

  it('throws WorkflowNotFoundError for a nonexistent id', async () => {
    const repository = new FakeWorkflowRepository();

    await expect(
      new GetWorkflow(repository).execute(WorkspaceId.generate(), WorkflowId.generate()),
    ).rejects.toThrow(WorkflowNotFoundError);
  });

  it('throws WorkflowNotFoundError for a workflow belonging to a different workspace', async () => {
    const repository = new FakeWorkflowRepository();
    const workflow = seededWorkflow(WorkspaceId.generate());
    repository.seed(workflow);

    await expect(
      new GetWorkflow(repository).execute(WorkspaceId.generate(), workflow.id),
    ).rejects.toThrow(WorkflowNotFoundError);
  });
});
