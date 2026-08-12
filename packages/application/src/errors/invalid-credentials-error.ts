import { ApplicationError } from './application-error.js';

/**
 * Deliberately one error, with one message, for both "no such email" and
 * "wrong password" — telling the two apart lets an attacker enumerate which
 * addresses have accounts (PRD v0.4.0, ADR-0003).
 */
export class InvalidCredentialsError extends ApplicationError {
  constructor() {
    super('Invalid credentials.');
  }
}
