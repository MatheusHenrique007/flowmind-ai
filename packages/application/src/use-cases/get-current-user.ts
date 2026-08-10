import type { UserId } from '@flowmind/domain';

import { UserNotFoundError } from '../errors/user-not-found-error.js';
import type { UserRepository } from '../ports/user-repository.js';

import { toAuthenticatedUser, type AuthenticatedUser } from './auth-session.js';

/**
 * Resolves the authenticated user's own identity. The UserId comes from the
 * verified access token, never from the request body/params — so this can only
 * ever return the caller's own record.
 */
export class GetCurrentUser {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: UserId): Promise<AuthenticatedUser> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }
    return toAuthenticatedUser(user);
  }
}
