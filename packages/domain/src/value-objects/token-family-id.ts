import { EntityId } from './entity-id.js';

/**
 * Groups every refresh token issued by successive rotations of one login
 * session. Presenting an already-rotated token revokes the whole family —
 * see docs/adr/0003-authentication-token-strategy.md.
 */
export class TokenFamilyId extends EntityId {
  private constructor(value: string) {
    super(value, 'TokenFamilyId');
  }

  static create(value: string): TokenFamilyId {
    return new TokenFamilyId(value);
  }

  static generate(): TokenFamilyId {
    return new TokenFamilyId(EntityId.generateValue());
  }
}
