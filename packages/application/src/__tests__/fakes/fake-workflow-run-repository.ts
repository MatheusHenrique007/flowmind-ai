import type { RunStatus, WorkflowRun, WorkflowRunId } from '@flowmind/domain';

import type { WorkflowRunRepository } from '../../ports/workflow-run-repository.js';
import type { WorkflowRunView } from '../../ports/workflow-run-view.js';

export class FakeWorkflowRunRepository implements WorkflowRunRepository {
  readonly savedStatusesInOrder: RunStatus[] = [];
  private readonly views = new Map<string, WorkflowRunView>();

  async save(run: WorkflowRun): Promise<void> {
    this.savedStatusesInOrder.push(run.status);
    this.views.set(run.id.value, {
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
    });
  }

  async findViewById(id: WorkflowRunId): Promise<WorkflowRunView | null> {
    return this.views.get(id.value) ?? null;
  }

  async listViews(): Promise<WorkflowRunView[]> {
    return [...this.views.values()];
  }
}
