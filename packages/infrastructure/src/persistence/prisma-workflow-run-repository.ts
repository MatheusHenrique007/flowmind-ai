import type { WorkflowRunRepository, WorkflowRunView } from '@flowmind/application';
import type {
  RunStatus,
  StepResultStatus,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@flowmind/domain';
import {
  Prisma,
  type PrismaClient,
  type WorkflowRun as WorkflowRunRow,
  type WorkflowStepResultRecord,
} from '@prisma/client';

type RunRowWithSteps = WorkflowRunRow & { stepResults: WorkflowStepResultRecord[] };

/**
 * The only place in the codebase allowed to import @prisma/client for
 * WorkflowRun persistence. `save()` deletes and recreates step result rows
 * on every call rather than diffing them — simplest correct approach for
 * this release's row counts (a handful of steps per run); revisit only if a
 * real performance problem shows up.
 */
export class PrismaWorkflowRunRepository implements WorkflowRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(run: WorkflowRun): Promise<void> {
    await this.prisma.workflowRun.upsert({
      where: { id: run.id.value },
      create: {
        id: run.id.value,
        workflowId: run.workflowId.value,
        // Denormalized from the run's workflow and written on create only —
        // never updated afterwards (ADR-0004).
        workspaceId: run.workspaceId.value,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      },
      update: {
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      },
    });

    await this.prisma.workflowStepResultRecord.deleteMany({
      where: { workflowRunId: run.id.value },
    });

    if (run.stepResults.length > 0) {
      await this.prisma.workflowStepResultRecord.createMany({
        data: run.stepResults.map((result) => ({
          workflowRunId: run.id.value,
          stepId: result.stepId.value,
          status: result.status,
          output:
            result.output === undefined
              ? Prisma.JsonNull
              : (result.output as Prisma.InputJsonValue),
          error: result.error,
          startedAt: result.startedAt,
          finishedAt: result.finishedAt,
        })),
      });
    }
  }

  /**
   * Filters on the run's own denormalized workspaceId rather than joining
   * through workflows — one less place a missed join condition could leak
   * another tenant's run (ADR-0004). Another workspace's run reads as null,
   * the same as a nonexistent id.
   */
  async findViewById(id: WorkflowRunId, workspaceId: WorkspaceId): Promise<WorkflowRunView | null> {
    const row = await this.prisma.workflowRun.findFirst({
      where: { id: id.value, workspaceId: workspaceId.value },
      include: { stepResults: true },
    });
    return row ? this.toView(row) : null;
  }

  async listViews(workspaceId: WorkspaceId): Promise<WorkflowRunView[]> {
    const rows = await this.prisma.workflowRun.findMany({
      where: { workspaceId: workspaceId.value },
      include: { stepResults: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toView(row));
  }

  private toView(row: RunRowWithSteps): WorkflowRunView {
    return {
      id: row.id,
      workflowId: row.workflowId,
      status: row.status as RunStatus,
      startedAt: row.startedAt ?? undefined,
      finishedAt: row.finishedAt ?? undefined,
      stepResults: row.stepResults.map((result) => ({
        stepId: result.stepId,
        status: result.status as StepResultStatus,
        output: result.output ?? undefined,
        error: result.error ?? undefined,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        durationMs: result.finishedAt.getTime() - result.startedAt.getTime(),
      })),
    };
  }
}
