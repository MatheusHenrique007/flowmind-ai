import type { RefreshToken, TokenFamilyId } from '@flowmind/domain';

export interface RefreshTokenRepository {
  save(token: RefreshToken): Promise<void>;
  /**
   * Looked up by hash, never by the raw token — the raw value is never stored,
   * so this is the only way a presented token can be identified.
   */
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  /** Revokes every not-yet-revoked token in the family. Used on reuse detection and logout. */
  revokeFamily(familyId: TokenFamilyId, revokedAt: Date): Promise<void>;
}
