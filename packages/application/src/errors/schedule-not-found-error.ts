import type { ScheduleId } from '@flowmind/domain';

import { ApplicationError } from './application-error.js';

/**
 * Application-level error — this layer knows nothing about HTTP. Mapping
 * this to a 404 is the Presentation layer's job (matches WorkflowNotFoundError
 * and WorkflowRunNotFoundError).
 */
export class ScheduleNotFoundError extends ApplicationError {
  constructor(scheduleId: ScheduleId) {
    super(`Schedule "${scheduleId.value}" was not found.`);
  }
}
