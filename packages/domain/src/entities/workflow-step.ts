import type { DestinationKind } from '../enums/destination-kind.js';
import type { Provider } from '../enums/provider.js';
import { StepType } from '../enums/step-type.js';
import type {
  AIStepConfig,
  DestinationStepConfig,
  StepConfig,
  TriggerStepConfig,
} from '../value-objects/step-config.js';
import { WorkflowStepId } from '../value-objects/workflow-step-id.js';

/**
 * A single step in a Workflow's definition. Constructed only through the
 * `trigger`/`ai`/`destination` factories below, so a step's `type` and its
 * `config` can never disagree — there is no code path that produces an AI
 * step holding a DestinationStepConfig.
 */
export class WorkflowStep {
  readonly id: WorkflowStepId;
  readonly config: StepConfig;

  private constructor(id: WorkflowStepId, config: StepConfig) {
    this.id = id;
    this.config = config;
  }

  get type(): StepType {
    return this.config.type;
  }

  static trigger(params: { id?: WorkflowStepId; kind: TriggerStepConfig['kind'] }): WorkflowStep {
    return new WorkflowStep(params.id ?? WorkflowStepId.generate(), {
      type: StepType.TRIGGER,
      kind: params.kind,
    });
  }

  static ai(params: {
    id?: WorkflowStepId;
    provider: Provider;
    instruction: string;
  }): WorkflowStep {
    return new WorkflowStep(params.id ?? WorkflowStepId.generate(), {
      type: StepType.AI,
      provider: params.provider,
      instruction: params.instruction,
    } satisfies AIStepConfig);
  }

  static destination(params: {
    id?: WorkflowStepId;
    destination: DestinationKind;
    target: string;
  }): WorkflowStep {
    return new WorkflowStep(params.id ?? WorkflowStepId.generate(), {
      type: StepType.DESTINATION,
      destination: params.destination,
      target: params.target,
    } satisfies DestinationStepConfig);
  }
}
