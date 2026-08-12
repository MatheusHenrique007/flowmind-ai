import type { Email } from '@flowmind/domain';

import { ApplicationError } from './application-error.js';

/**
 * Registration is the one place where revealing that an address is taken is
 * unavoidable — the user has to be told why the signup failed. Login stays
 * generic (InvalidCredentialsError).
 */
export class EmailAlreadyRegisteredError extends ApplicationError {
  constructor(email: Email) {
    super(`An account already exists for "${email.value}".`);
  }
}
