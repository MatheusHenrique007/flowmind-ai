import type { ScheduleId, WorkspaceId } from '@flowmind/domain';

import { ScheduleNotFoundError } from '../errors/schedule-not-found-error.js';
import type { ScheduleQueue } from '../ports/schedule-queue.js';
import type { ScheduleRepository } from '../ports/schedule-repository.js';

/**
 * Unregisters from the queue backend FIRST, then deletes the Postgres row.
 * If unregistration fails, aborts entirely — Postgres is left untouched, the
 * Schedule stays intact/active, and the caller can retry. The worst residual
 * outcome (unregister succeeds, the DB delete then fails) is a harmless
 * zombie row: retrying the delete calls removeJobScheduler again, which is a
 * safe no-op on an already-removed id. See ADR-0006.
 *
 * No existing DeleteX use case in this codebase establishes a "return
 * quietly on not-found" precedent, so this throws ScheduleNotFoundError,
 * which the route maps to 404 — matching GetWorkflowRun's not-found handling.
 */
export class DeleteSchedule {
  constructor(
    private readonly scheduleRepository: ScheduleRepository,
    private readonly scheduleQueue: ScheduleQueue,
  ) {}

  async execute(workspaceId: WorkspaceId, scheduleId: ScheduleId): Promise<void> {
    const schedule = await this.scheduleRepository.findById(scheduleId, workspaceId);
    if (!schedule) {
      throw new ScheduleNotFoundError(scheduleId);
    }

    await this.scheduleQueue.unregister(scheduleId);
    await this.scheduleRepository.delete(scheduleId, workspaceId);
  }
}
