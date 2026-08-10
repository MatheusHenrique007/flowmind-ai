import { DomainError } from './domain-error.js';

export class WeakPasswordError extends DomainError {
  constructor(reason: string) {
    super(`Password rejected: ${reason}`);
  }
}
