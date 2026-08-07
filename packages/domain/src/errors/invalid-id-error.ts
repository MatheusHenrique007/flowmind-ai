import { DomainError } from './domain-error.js';

export class InvalidIdError extends DomainError {
  constructor(idType: string) {
    super(`${idType} must be a non-empty string.`);
  }
}
