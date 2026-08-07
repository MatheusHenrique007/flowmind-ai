import { EntityId } from './entity-id.js';

export class WorkflowId extends EntityId {
  private constructor(value: string) {
    super(value, 'WorkflowId');
  }

  static create(value: string): WorkflowId {
    return new WorkflowId(value);
  }

  static generate(): WorkflowId {
    return new WorkflowId(EntityId.generateValue());
  }
}
