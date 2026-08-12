import { Email, InvalidEmailError, TokenFamilyId } from '@flowmind/domain';

import { InvalidCredentialsError } from '../errors/invalid-credentials-error.js';
import type { Clock } from '../ports/clock.js';
import type { RefreshTokenRepository } from '../ports/refresh-token-repository.js';
import type { TokenService } from '../ports/token-service.js';
import type { UserRepository } from '../ports/user-repository.js';

import { issueSession, type AuthenticatedSession } from './auth-session.js';

export interface LoginUserInput {
  email: string;
  password: string;
}

/**
 * Every failure path throws the same InvalidCredentialsError — a malformed
 * address, an unknown account, and a wrong password are indistinguishable to
 * the caller, so this endpoint cannot be used to discover which emails have
 * accounts (PRD v0.4.0).
 */
export class LoginUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
    private readonly clock: Clock,
  ) {}

  async execute(input: LoginUserInput): Promise<AuthenticatedSession> {
    let email: Email;
    try {
      email = Email.create(input.email);
    } catch (error) {
      if (error instanceof InvalidEmailError) {
        throw new InvalidCredentialsError();
      }
      throw error;
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    if (!(await user.verifyPassword(input.password))) {
      throw new InvalidCredentialsError();
    }

    // A fresh login starts its own token family: revoking one session's chain
    // (on reuse detection) must not log the user out of their other devices.
    return issueSession({
      user,
      familyId: TokenFamilyId.generate(),
      tokenService: this.tokenService,
      refreshTokenRepository: this.refreshTokenRepository,
      clock: this.clock,
    });
  }
}
