import type { Schedule, WorkspaceId } from '@flowmind/domain';

import type { ScheduleRepository } from '../ports/schedule-repository.js';

/**
 * Returns the workspace's own Schedule entities, unshaped. nextRunAt is
 * derived from BullMQ's job scheduler state, not from Postgres, so it cannot
 * be attached here without giving this use case a dependency on ScheduleQueue
 * for a read-only convenience field — the Presentation layer attaches it by
 * calling Infrastructure directly when shaping the HTTP response (see the API
 * layer's schedules route and ADR-0006).
 */
export class ListSchedules {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  /** Only ever returns schedules belonging to `workspaceId`. */
  async execute(workspaceId: WorkspaceId): Promise<Schedule[]> {
    return this.scheduleRepository.listByWorkspace(workspaceId);
  }
}
