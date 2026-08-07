import type { RunStatus } from '../enums/run-status.js';

import { DomainError } from './domain-error.js';

export class InvalidWorkflowRunTransitionError extends DomainError {
  constructor(from: RunStatus, to: RunStatus) {
    super(`Cannot transition WorkflowRun from "${from}" to "${to}".`);
  }
}
