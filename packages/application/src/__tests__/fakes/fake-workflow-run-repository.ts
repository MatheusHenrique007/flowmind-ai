import type { RunStatus, WorkflowRun, WorkflowRunId, WorkspaceId } from '@flowmind/domain';

import type { WorkflowRunRepository } from '../../ports/workflow-run-repository.js';
import type { WorkflowRunView } from '../../ports/workflow-run-view.js';

export class FakeWorkflowRunRepository implements WorkflowRunRepository {
  readonly savedStatusesInOrder: RunStatus[] = [];
  private readonly views = new Map<string, { workspaceId: string; view: WorkflowRunView }>();

  async save(run: WorkflowRun): Promise<void> {
    this.savedStatusesInOrder.push(run.status);
    this.views.set(run.id.value, {
      workspaceId: run.workspaceId.value,
      view: {
        id: run.id.value,
        workflowId: run.workflowId.value,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        stepResults: run.stepResults.map((result) => ({
          stepId: result.stepId.value,
          status: result.status,
          output: result.output,
          error: result.error,
          startedAt: result.startedAt,
          finishedAt: result.finishedAt,
          durationMs: result.durationMs,
        })),
      },
    });
  }

  /** Scoped like the real repository: another workspace's run reads as missing. */
  async findViewById(id: WorkflowRunId, workspaceId: WorkspaceId): Promise<WorkflowRunView | null> {
    const stored = this.views.get(id.value);
    if (!stored || stored.workspaceId !== workspaceId.value) {
      return null;
    }
    return stored.view;
  }

  async listViews(workspaceId: WorkspaceId): Promise<WorkflowRunView[]> {
    return [...this.views.values()]
      .filter((stored) => stored.workspaceId === workspaceId.value)
      .map((stored) => stored.view);
  }
}
