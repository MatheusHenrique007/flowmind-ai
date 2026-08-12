import type { RefreshToken, TokenFamilyId } from '@flowmind/domain';

import type { RefreshTokenRepository } from '../../ports/refresh-token-repository.js';

export class FakeRefreshTokenRepository implements RefreshTokenRepository {
  private readonly tokens = new Map<string, RefreshToken>();

  async save(token: RefreshToken): Promise<void> {
    this.tokens.set(token.tokenHash, token);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.tokens.get(tokenHash) ?? null;
  }

  async revokeFamily(familyId: TokenFamilyId, revokedAt: Date): Promise<void> {
    for (const token of this.tokens.values()) {
      if (token.familyId.equals(familyId)) {
        token.revoke(revokedAt);
      }
    }
  }

  /** Test-only inspection helper — not part of the port. */
  all(): RefreshToken[] {
    return [...this.tokens.values()];
  }
}
