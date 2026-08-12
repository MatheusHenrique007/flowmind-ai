import { DomainError } from './domain-error.js';

export class InvalidWorkspaceError extends DomainError {
  constructor(reason: string) {
    super(`Invalid workspace: ${reason}`);
  }
}
