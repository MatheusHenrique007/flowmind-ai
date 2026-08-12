import { DomainError } from './domain-error.js';

export class InvalidEmailError extends DomainError {
  constructor(reason: string) {
    super(`Invalid email: ${reason}`);
  }
}
