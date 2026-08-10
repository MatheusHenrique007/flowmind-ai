import { describe, expect, it } from 'vitest';

import { WorkflowStep } from '../entities/workflow-step.js';
import { Workflow } from '../entities/workflow.js';
import { DestinationKind } from '../enums/destination-kind.js';
import { Provider } from '../enums/provider.js';
import { InvalidWorkflowDefinitionError } from '../errors/invalid-workflow-definition-error.js';
import { WorkspaceId } from '../value-objects/workspace-id.js';

const workspaceId = WorkspaceId.generate();

function validSteps() {
  return [
    WorkflowStep.trigger({ kind: 'webhook' }),
    WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize this.' }),
    WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
  ];
}

describe('Workflow', () => {
  it('can be created with a name and a valid Trigger -> AI -> Destination sequence', () => {
    const workflow = Workflow.create({
      name: 'Webhook to Slack',
      steps: validSteps(),
      workspaceId,
    });

    expect(workflow.name).toBe('Webhook to Slack');
    expect(workflow.steps).toHaveLength(3);
  });

  it('carries the owning workspaceId it was created with', () => {
    const otherWorkspaceId = WorkspaceId.generate();
    const workflow = Workflow.create({
      name: 'Owned',
      steps: validSteps(),
      workspaceId: otherWorkspaceId,
    });

    expect(workflow.workspaceId.equals(otherWorkspaceId)).toBe(true);
    expect(workflow.workspaceId.equals(workspaceId)).toBe(false);
  });

  it('cannot exist with zero steps', () => {
    expect(() => Workflow.create({ name: 'Empty', steps: [], workspaceId })).toThrow(
      InvalidWorkflowDefinitionError,
    );
  });

  it('rejects an empty or blank name', () => {
    expect(() => Workflow.create({ name: '   ', steps: validSteps(), workspaceId })).toThrow(
      InvalidWorkflowDefinitionError,
    );
  });

  it('rejects a workflow whose first step is not a Trigger', () => {
    const steps = [
      WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
      WorkflowStep.trigger({ kind: 'webhook' }),
      WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
    ];

    expect(() => Workflow.create({ name: 'Bad order', steps, workspaceId })).toThrow(
      InvalidWorkflowDefinitionError,
    );
  });

  it('rejects a workflow missing an AI step', () => {
    const steps = [
      WorkflowStep.trigger({ kind: 'webhook' }),
      WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
    ];

    expect(() => Workflow.create({ name: 'No AI step', steps, workspaceId })).toThrow(
      InvalidWorkflowDefinitionError,
    );
  });

  it('rejects a workflow missing a Destination step', () => {
    const steps = [
      WorkflowStep.trigger({ kind: 'webhook' }),
      WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
    ];

    expect(() => Workflow.create({ name: 'No destination step', steps, workspaceId })).toThrow(
      InvalidWorkflowDefinitionError,
    );
  });

  it('accepts more than one AI or Destination step — the domain does not cap composition', () => {
    const steps = [
      WorkflowStep.trigger({ kind: 'webhook' }),
      WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
      WorkflowStep.ai({ provider: Provider.OPENAI, instruction: 'Classify.' }),
      WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
    ];

    expect(() => Workflow.create({ name: 'Multi-AI', steps, workspaceId })).not.toThrow();
  });
});
