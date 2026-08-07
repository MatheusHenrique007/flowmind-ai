import type { WorkflowId } from '@flowmind/domain';

import { ApplicationError } from './application-error.js';

/**
 * Application-level error — this layer knows nothing about HTTP. Mapping
 * this to a 404 is the Presentation layer's job.
 */
export class WorkflowNotFoundError extends ApplicationError {
  constructor(workflowId: WorkflowId) {
    super(`Workflow "${workflowId.value}" was not found.`);
  }
}
