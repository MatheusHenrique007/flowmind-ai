import { WorkflowStep } from '@flowmind/domain';

import type { WorkflowStepInput } from './workflow-input.js';

/**
 * Maps raw WorkflowStepInput DTOs to domain WorkflowStep instances via its
 * trigger()/ai()/destination() factories — the only place Application
 * touches WorkflowStep construction, shared by CreateWorkflow and
 * UpdateWorkflow so both go through the exact same mapping.
 */
export function buildWorkflowSteps(inputs: readonly WorkflowStepInput[]): WorkflowStep[] {
  return inputs.map((input) => {
    switch (input.type) {
      case 'TRIGGER':
        return WorkflowStep.trigger({ kind: input.kind });
      case 'AI':
        return WorkflowStep.ai({ provider: input.provider, instruction: input.instruction });
      case 'DESTINATION':
        return WorkflowStep.destination({
          destination: input.destination,
          target: input.target,
        });
    }
  });
}
