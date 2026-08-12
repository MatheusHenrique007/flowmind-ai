import { ApplicationError } from './application-error.js';

/**
 * One error for every rejected refresh attempt — unknown, expired, and
 * already-rotated tokens are indistinguishable to the caller. Maps to 401.
 */
export class InvalidRefreshTokenError extends ApplicationError {
  constructor() {
    super('Invalid refresh token.');
  }
}
