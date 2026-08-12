import { DestinationKind, Provider, WorkflowId, WorkspaceId } from '@flowmind/domain';
import { describe, expect, it } from 'vitest';

import { WorkflowNotFoundError } from '../errors/workflow-not-found-error.js';
import { CreateWorkflow } from '../use-cases/create-workflow.js';
import { UpdateWorkflow } from '../use-cases/update-workflow.js';

import { FakeWorkflowRepository } from './fakes/fake-workflow-repository.js';

function validInput(instruction: string) {
  return {
    name: 'Webhook to Slack',
    steps: [
      { type: 'TRIGGER' as const, kind: 'webhook' as const },
      { type: 'AI' as const, provider: Provider.CLAUDE, instruction },
      { type: 'DESTINATION' as const, destination: DestinationKind.SLACK, target: '#alerts' },
    ],
  };
}

const workspaceId = WorkspaceId.generate();

describe('UpdateWorkflow', () => {
  it('throws WorkflowNotFoundError when the workflow does not exist', async () => {
    const repository = new FakeWorkflowRepository();
    const useCase = new UpdateWorkflow(repository);

    await expect(
      useCase.execute(workspaceId, WorkflowId.generate(), validInput('x')),
    ).rejects.toThrow(WorkflowNotFoundError);
  });

  it('replaces the definition of an existing workflow, keeping its id', async () => {
    const repository = new FakeWorkflowRepository();
    const created = await new CreateWorkflow(repository).execute(
      workspaceId,
      validInput('Summarize.'),
    );

    const updated = await new UpdateWorkflow(repository).execute(
      workspaceId,
      created.id,
      validInput('Classify urgency.'),
    );

    expect(updated.id.equals(created.id)).toBe(true);
    const aiStep = updated.steps[1];
    expect(aiStep?.config).toMatchObject({ instruction: 'Classify urgency.' });
  });
});
