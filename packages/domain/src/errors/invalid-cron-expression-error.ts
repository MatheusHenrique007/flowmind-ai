import { DomainError } from './domain-error.js';

export class InvalidCronExpressionError extends DomainError {
  constructor(reason: string) {
    super(`Invalid cron expression: ${reason}`);
  }
}
