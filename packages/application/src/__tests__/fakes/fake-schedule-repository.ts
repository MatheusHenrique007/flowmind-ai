import type { Schedule, ScheduleId, WorkspaceId } from '@flowmind/domain';

import type { ScheduleRepository } from '../../ports/schedule-repository.js';

export class FakeScheduleRepository implements ScheduleRepository {
  private readonly schedules = new Map<string, Schedule>();

  seed(schedule: Schedule): void {
    this.schedules.set(schedule.id.value, schedule);
  }

  async save(schedule: Schedule): Promise<void> {
    this.schedules.set(schedule.id.value, schedule);
  }

  /** Mirrors WorkflowRepository's isolation rule: cross-tenant reads as missing. */
  async findById(id: ScheduleId, workspaceId: WorkspaceId): Promise<Schedule | null> {
    const schedule = this.schedules.get(id.value);
    if (!schedule || !schedule.workspaceId.equals(workspaceId)) {
      return null;
    }
    return schedule;
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<Schedule[]> {
    return [...this.schedules.values()].filter((s) => s.workspaceId.equals(workspaceId));
  }

  async delete(id: ScheduleId, workspaceId: WorkspaceId): Promise<void> {
    const schedule = this.schedules.get(id.value);
    if (schedule && schedule.workspaceId.equals(workspaceId)) {
      this.schedules.delete(id.value);
    }
  }

  async countByWorkspace(workspaceId: WorkspaceId): Promise<number> {
    return (await this.listByWorkspace(workspaceId)).length;
  }
}
