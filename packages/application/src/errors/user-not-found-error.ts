import type { UserId } from '@flowmind/domain';

import { ApplicationError } from './application-error.js';

export class UserNotFoundError extends ApplicationError {
  constructor(userId: UserId) {
    super(`User "${userId.value}" was not found.`);
  }
}
