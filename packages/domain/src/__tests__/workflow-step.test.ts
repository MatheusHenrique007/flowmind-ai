import { describe, expect, it } from 'vitest';

import { WorkflowStep } from '../entities/workflow-step.js';
import { DestinationKind } from '../enums/destination-kind.js';
import { Provider } from '../enums/provider.js';
import { StepType } from '../enums/step-type.js';

describe('WorkflowStep', () => {
  it('creates a Trigger step whose type and config always agree', () => {
    const step = WorkflowStep.trigger({ kind: 'webhook' });

    expect(step.type).toBe(StepType.TRIGGER);
    expect(step.config).toEqual({ type: StepType.TRIGGER, kind: 'webhook' });
  });

  it('creates an AI step carrying its provider and instruction', () => {
    const step = WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize this.' });

    expect(step.type).toBe(StepType.AI);
    expect(step.config).toEqual({
      type: StepType.AI,
      provider: Provider.CLAUDE,
      instruction: 'Summarize this.',
    });
  });

  it('creates a Destination step carrying its destination kind and target', () => {
    const step = WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#eng' });

    expect(step.type).toBe(StepType.DESTINATION);
    expect(step.config).toEqual({
      type: StepType.DESTINATION,
      destination: DestinationKind.SLACK,
      target: '#eng',
    });
  });

  it('generates a unique id when none is supplied', () => {
    const a = WorkflowStep.trigger({ kind: 'webhook' });
    const b = WorkflowStep.trigger({ kind: 'webhook' });

    expect(a.id.equals(b.id)).toBe(false);
  });
});
