import {
  DestinationKind,
  InvalidWorkflowDefinitionError,
  Provider,
  WorkspaceId,
} from '@flowmind/domain';
import { describe, expect, it } from 'vitest';

import { CreateWorkflow } from '../use-cases/create-workflow.js';

import { FakeWorkflowRepository } from './fakes/fake-workflow-repository.js';

function validInput() {
  return {
    name: 'Webhook to Slack',
    steps: [
      { type: 'TRIGGER' as const, kind: 'webhook' as const },
      { type: 'AI' as const, provider: Provider.CLAUDE, instruction: 'Summarize.' },
      { type: 'DESTINATION' as const, destination: DestinationKind.SLACK, target: '#alerts' },
    ],
  };
}

const workspaceId = WorkspaceId.generate();

describe('CreateWorkflow', () => {
  it('creates and persists a valid workflow', async () => {
    const repository = new FakeWorkflowRepository();
    const useCase = new CreateWorkflow(repository);

    const workflow = await useCase.execute(workspaceId, validInput());

    expect(workflow.name).toBe('Webhook to Slack');
    expect(workflow.steps).toHaveLength(3);
    await expect(repository.findById(workflow.id, workspaceId)).resolves.toBe(workflow);
  });

  it('propagates the domain validation error for an invalid composition', async () => {
    const repository = new FakeWorkflowRepository();
    const useCase = new CreateWorkflow(repository);
    const input = validInput();
    input.steps = [input.steps[1]!, input.steps[0]!, input.steps[2]!]; // AI first, not Trigger

    await expect(useCase.execute(workspaceId, input)).rejects.toThrow(
      InvalidWorkflowDefinitionError,
    );
  });

  it('never calls save() when validation fails', async () => {
    const repository = new FakeWorkflowRepository();
    let saveCalled = false;
    const originalSave = repository.save.bind(repository);
    repository.save = async (workflow) => {
      saveCalled = true;
      return originalSave(workflow);
    };
    const useCase = new CreateWorkflow(repository);
    const input = validInput();
    input.steps = [input.steps[0]!]; // missing AI and Destination

    await expect(useCase.execute(workspaceId, input)).rejects.toThrow();
    expect(saveCalled).toBe(false);
  });
});
