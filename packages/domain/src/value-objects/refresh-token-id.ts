import { EntityId } from './entity-id.js';

export class RefreshTokenId extends EntityId {
  private constructor(value: string) {
    super(value, 'RefreshTokenId');
  }

  static create(value: string): RefreshTokenId {
    return new RefreshTokenId(value);
  }

  static generate(): RefreshTokenId {
    return new RefreshTokenId(EntityId.generateValue());
  }
}
