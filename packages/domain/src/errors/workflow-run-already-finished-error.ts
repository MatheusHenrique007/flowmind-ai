import type { RunStatus } from '../enums/run-status.js';

import { DomainError } from './domain-error.js';

export class WorkflowRunAlreadyFinishedError extends DomainError {
  constructor(currentStatus: RunStatus) {
    super(
      `WorkflowRun is already finished with status "${currentStatus}" and cannot transition again.`,
    );
  }
}
