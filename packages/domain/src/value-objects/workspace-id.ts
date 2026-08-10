import { EntityId } from './entity-id.js';

export class WorkspaceId extends EntityId {
  private constructor(value: string) {
    super(value, 'WorkspaceId');
  }

  static create(value: string): WorkspaceId {
    return new WorkspaceId(value);
  }

  static generate(): WorkspaceId {
    return new WorkspaceId(EntityId.generateValue());
  }
}
