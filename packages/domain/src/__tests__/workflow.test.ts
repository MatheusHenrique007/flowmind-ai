import { describe, expect, it } from 'vitest';

import { WorkflowStep } from '../entities/workflow-step.js';
import { Workflow } from '../entities/workflow.js';
import { DestinationKind } from '../enums/destination-kind.js';
import { Provider } from '../enums/provider.js';
import { InvalidWorkflowDefinitionError } from '../errors/invalid-workflow-definition-error.js';

function validSteps() {
  return [
    WorkflowStep.trigger({ kind: 'webhook' }),
    WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize this.' }),
    WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
  ];
}

describe('Workflow', () => {
  it('can be created with a name and a valid Trigger -> AI -> Destination sequence', () => {
    const workflow = Workflow.create({ name: 'Webhook to Slack', steps: validSteps() });

    expect(workflow.name).toBe('Webhook to Slack');
    expect(workflow.steps).toHaveLength(3);
  });

  it('cannot exist with zero steps', () => {
    expect(() => Workflow.create({ name: 'Empty', steps: [] })).toThrow(
      InvalidWorkflowDefinitionError,
    );
  });

  it('rejects an empty or blank name', () => {
    expect(() => Workflow.create({ name: '   ', steps: validSteps() })).toThrow(
      InvalidWorkflowDefinitionError,
    );
  });

  it('rejects a workflow whose first step is not a Trigger', () => {
    const steps = [
      WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
      WorkflowStep.trigger({ kind: 'webhook' }),
      WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
    ];

    expect(() => Workflow.create({ name: 'Bad order', steps })).toThrow(
      InvalidWorkflowDefinitionError,
    );
  });

  it('rejects a workflow missing an AI step', () => {
    const steps = [
      WorkflowStep.trigger({ kind: 'webhook' }),
      WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
    ];

    expect(() => Workflow.create({ name: 'No AI step', steps })).toThrow(
      InvalidWorkflowDefinitionError,
    );
  });

  it('rejects a workflow missing a Destination step', () => {
    const steps = [
      WorkflowStep.trigger({ kind: 'webhook' }),
      WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
    ];

    expect(() => Workflow.create({ name: 'No destination step', steps })).toThrow(
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

    expect(() => Workflow.create({ name: 'Multi-AI', steps })).not.toThrow();
  });
});
