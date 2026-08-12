import { RefreshTokenSecret } from '@flowmind/domain';

import { InvalidRefreshTokenError } from '../errors/invalid-refresh-token-error.js';
import type { Clock } from '../ports/clock.js';
import type { RefreshTokenRepository } from '../ports/refresh-token-repository.js';
import type { TokenService } from '../ports/token-service.js';
import type { UserRepository } from '../ports/user-repository.js';

import { issueSession, type AuthenticatedSession } from './auth-session.js';

/**
 * Rotates a refresh token: the presented token is revoked and a replacement
 * sharing its familyId is issued, so a token is single-use by construction.
 *
 * If an already-revoked token is presented — meaning it was either rotated
 * already (replay) or explicitly revoked — the entire family is revoked. That
 * is the reuse-detection rule from ADR-0003: a stolen token can be used at
 * most once before the whole session chain dies.
 */
export class RefreshSession {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    private readonly clock: Clock,
  ) {}

  async execute(presentedToken: string): Promise<AuthenticatedSession> {
    if (!presentedToken) {
      throw new InvalidRefreshTokenError();
    }

    const now = this.clock.now();
    const stored = await this.refreshTokenRepository.findByTokenHash(
      RefreshTokenSecret.hashOf(presentedToken),
    );

    if (!stored) {
      throw new InvalidRefreshTokenError();
    }

    if (stored.isRevoked()) {
      await this.refreshTokenRepository.revokeFamily(stored.familyId, now);
      throw new InvalidRefreshTokenError();
    }

    if (stored.isExpired(now)) {
      throw new InvalidRefreshTokenError();
    }

    const user = await this.userRepository.findById(stored.userId);
    if (!user) {
      // The token outlived its user — revoke the family rather than leaving a
      // usable token behind.
      await this.refreshTokenRepository.revokeFamily(stored.familyId, now);
      throw new InvalidRefreshTokenError();
    }

    // Revoke before issuing: if the save of the replacement fails, the client
    // is logged out rather than left holding a token that is still valid.
    stored.revoke(now);
    await this.refreshTokenRepository.save(stored);

    return issueSession({
      user,
      familyId: stored.familyId,
      tokenService: this.tokenService,
      refreshTokenRepository: this.refreshTokenRepository,
      clock: this.clock,
    });
  }
}
