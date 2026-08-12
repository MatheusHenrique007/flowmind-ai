import type { ScheduleRepository } from '@flowmind/application';
import { Schedule, ScheduleId, WorkflowId, WorkspaceId } from '@flowmind/domain';
import type { PrismaClient } from '@prisma/client';

/**
 * The only place in the codebase allowed to import @prisma/client for
 * Schedule persistence — Application and Engine never see it. Mirrors
 * PrismaWorkflowRepository's isolation rule exactly: workspaceId is part of
 * the WHERE clause, never a check applied to an already-loaded row.
 */
export class PrismaScheduleRepository implements ScheduleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(schedule: Schedule): Promise<void> {
    await this.prisma.schedule.upsert({
      where: { id: schedule.id.value },
      create: {
        id: schedule.id.value,
        workflowId: schedule.workflowId.value,
        workspaceId: schedule.workspaceId.value,
        cronExpression: schedule.cronExpression,
        createdAt: schedule.createdAt,
      },
      update: { cronExpression: schedule.cronExpression },
    });
  }

  async findById(id: ScheduleId, workspaceId: WorkspaceId): Promise<Schedule | null> {
    const row = await this.prisma.schedule.findFirst({
      where: { id: id.value, workspaceId: workspaceId.value },
    });
    if (!row) {
      return null;
    }
    return this.toDomain(row);
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<Schedule[]> {
    const rows = await this.prisma.schedule.findMany({
      where: { workspaceId: workspaceId.value },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async delete(id: ScheduleId, workspaceId: WorkspaceId): Promise<void> {
    // deleteMany, not delete: a delete-by-id-only would throw if the row
    // belongs to another workspace instead of silently no-op'ing, which
    // would leak that the id exists.
    await this.prisma.schedule.deleteMany({
      where: { id: id.value, workspaceId: workspaceId.value },
    });
  }

  async countByWorkspace(workspaceId: WorkspaceId): Promise<number> {
    return this.prisma.schedule.count({ where: { workspaceId: workspaceId.value } });
  }

  private toDomain(row: {
    id: string;
    workflowId: string;
    workspaceId: string;
    cronExpression: string;
    createdAt: Date;
  }): Schedule {
    return Schedule.create({
      id: ScheduleId.create(row.id),
      workflowId: WorkflowId.create(row.workflowId),
      workspaceId: WorkspaceId.create(row.workspaceId),
      cronExpression: row.cronExpression,
      createdAt: row.createdAt,
    });
  }
}
