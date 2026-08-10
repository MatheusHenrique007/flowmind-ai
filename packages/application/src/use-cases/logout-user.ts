import { RefreshTokenSecret } from '@flowmind/domain';

import type { Clock } from '../ports/clock.js';
import type { RefreshTokenRepository } from '../ports/refresh-token-repository.js';

/**
 * Revokes the presented refresh token's whole family, ending that login
 * session chain: after logout no token derived from it can be rotated again.
 *
 * Never throws for an unknown/absent token — logging out is idempotent, and a
 * caller with no valid session is already in the state it asked for. Whether
 * a token existed is not reported back, so this endpoint reveals nothing.
 */
export class LogoutUser {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly clock: Clock,
  ) {}

  async execute(presentedToken: string | undefined): Promise<void> {
    if (!presentedToken) {
      return;
    }

    const stored = await this.refreshTokenRepository.findByTokenHash(
      RefreshTokenSecret.hashOf(presentedToken),
    );
    if (!stored) {
      return;
    }

    await this.refreshTokenRepository.revokeFamily(stored.familyId, this.clock.now());
  }
}
