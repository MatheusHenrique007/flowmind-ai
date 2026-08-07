import type { WorkflowRunId } from '@flowmind/domain';

import { ApplicationError } from './application-error.js';

export class WorkflowRunNotFoundError extends ApplicationError {
  constructor(workflowRunId: WorkflowRunId) {
    super(`WorkflowRun "${workflowRunId.value}" was not found.`);
  }
}
