import { DomainError } from './domain-error.js';

export class InvalidPasswordHashError extends DomainError {
  constructor() {
    super('Stored password hash is not in the expected scrypt format.');
  }
}
