import { DestinationKind, Provider, Workflow, WorkflowStep, WorkspaceId } from '@flowmind/domain';
import { describe, expect, it } from 'vitest';

import { ListWorkflows } from '../use-cases/list-workflows.js';

import { FakeWorkflowRepository } from './fakes/fake-workflow-repository.js';

function seededWorkflow(workspaceId: WorkspaceId, name: string) {
  return Workflow.create({
    name,
    steps: [
      WorkflowStep.trigger({ kind: 'webhook' }),
      WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
      WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
    ],
    workspaceId,
  });
}

describe('ListWorkflows', () => {
  it("returns only the calling workspace's workflows", async () => {
    const workspaceId = WorkspaceId.generate();
    const otherWorkspaceId = WorkspaceId.generate();
    const repository = new FakeWorkflowRepository();
    const mine = seededWorkflow(workspaceId, 'Mine');
    repository.seed(mine);
    repository.seed(seededWorkflow(otherWorkspaceId, 'Theirs'));

    const workflows = await new ListWorkflows(repository).execute(workspaceId);

    expect(workflows).toHaveLength(1);
    expect(workflows[0]?.id.equals(mine.id)).toBe(true);
  });

  it('returns an empty array for a workspace with zero workflows', async () => {
    const repository = new FakeWorkflowRepository();

    const workflows = await new ListWorkflows(repository).execute(WorkspaceId.generate());

    expect(workflows).toEqual([]);
  });
});
