import { EntityId } from './entity-id.js';

export class UserId extends EntityId {
  private constructor(value: string) {
    super(value, 'UserId');
  }

  static create(value: string): UserId {
    return new UserId(value);
  }

  static generate(): UserId {
    return new UserId(EntityId.generateValue());
  }
}
