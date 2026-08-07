import { EntityId } from './entity-id.js';

export class WorkflowRunId extends EntityId {
  private constructor(value: string) {
    super(value, 'WorkflowRunId');
  }

  static create(value: string): WorkflowRunId {
    return new WorkflowRunId(value);
  }

  static generate(): WorkflowRunId {
    return new WorkflowRunId(EntityId.generateValue());
  }
}
