import { DomainError } from './domain-error.js';

export class InvalidWorkflowDefinitionError extends DomainError {
  constructor(reason: string) {
    super(`Invalid workflow definition: ${reason}`);
  }
}
