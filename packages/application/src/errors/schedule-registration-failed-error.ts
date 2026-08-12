import { ApplicationError } from './application-error.js';

/**
 * Thrown when persisting a Schedule to Postgres succeeded but registering it
 * with the queue backend failed. The use case has already best-effort
 * compensated by deleting the Postgres row before this is thrown — see
 * CreateSchedule and ADR-0006.
 */
export class ScheduleRegistrationFailedError extends ApplicationError {
  constructor(cause: unknown) {
    super(
      `Failed to register the schedule with the execution queue: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    this.cause = cause;
  }
}
