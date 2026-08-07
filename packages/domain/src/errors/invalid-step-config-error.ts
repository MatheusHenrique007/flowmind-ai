import { DomainError } from './domain-error.js';

export class InvalidStepConfigError extends DomainError {
  constructor(reason: string) {
    super(`Invalid step config: ${reason}`);
  }
}
