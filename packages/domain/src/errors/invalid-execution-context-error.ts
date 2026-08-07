import { DomainError } from './domain-error.js';

export class InvalidExecutionContextError extends DomainError {
  constructor(reason: string) {
    super(`Invalid ExecutionContext: ${reason}`);
  }
}
