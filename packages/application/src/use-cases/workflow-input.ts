import type { DestinationKind, Provider } from '@flowmind/domain';

/**
 * Application-level input DTOs for creating/updating a Workflow — the shape
 * a Presentation layer (Fastify route body, or a mapped frontend payload)
 * hands in. Deliberately not the Domain's WorkflowStep: this is raw,
 * unvalidated data until CreateWorkflow/UpdateWorkflow pass it through
 * Workflow.create()'s invariants.
 */
export interface TriggerStepInput {
  type: 'TRIGGER';
  kind: 'webhook';
}

export interface AIStepInput {
  type: 'AI';
  provider: Provider;
  instruction: string;
}

export interface DestinationStepInput {
  type: 'DESTINATION';
  destination: DestinationKind;
  target: string;
}

export type WorkflowStepInput = TriggerStepInput | AIStepInput | DestinationStepInput;

export interface WorkflowInput {
  name: string;
  steps: WorkflowStepInput[];
}
