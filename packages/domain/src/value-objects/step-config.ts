import type { DestinationKind } from '../enums/destination-kind.js';
import type { Provider } from '../enums/provider.js';
import { StepType } from '../enums/step-type.js';

export interface TriggerStepConfig {
  readonly type: typeof StepType.TRIGGER;
  readonly kind: 'webhook';
}

export interface AIStepConfig {
  readonly type: typeof StepType.AI;
  readonly provider: Provider;
  readonly instruction: string;
}

export interface DestinationStepConfig {
  readonly type: typeof StepType.DESTINATION;
  readonly destination: DestinationKind;
  readonly target: string;
}

export type StepConfig = TriggerStepConfig | AIStepConfig | DestinationStepConfig;
