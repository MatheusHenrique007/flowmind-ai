import { EntityId } from './entity-id.js';

export class WorkflowStepId extends EntityId {
  private constructor(value: string) {
    super(value, 'WorkflowStepId');
  }

  static create(value: string): WorkflowStepId {
    return new WorkflowStepId(value);
  }

  static generate(): WorkflowStepId {
    return new WorkflowStepId(EntityId.generateValue());
  }
}
