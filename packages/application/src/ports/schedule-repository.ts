import type { Schedule, ScheduleId, WorkspaceId } from '@flowmind/domain';

export interface ScheduleRepository {
  save(schedule: Schedule): Promise<void>;
  /**
   * Scoped by workspace, not just by id — a schedule that exists but belongs
   * to another workspace returns `null`, the same answer as a nonexistent id,
   * matching WorkflowRepository's isolation rule (ADR-0004).
   */
  findById(id: ScheduleId, workspaceId: WorkspaceId): Promise<Schedule | null>;
  listByWorkspace(workspaceId: WorkspaceId): Promise<Schedule[]>;
  delete(id: ScheduleId, workspaceId: WorkspaceId): Promise<void>;
  countByWorkspace(workspaceId: WorkspaceId): Promise<number>;
}
