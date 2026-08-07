import type { RunStatus, WorkflowRun } from '@flowmind/domain';

import type { WorkflowRunRepository } from '../../ports/workflow-run-repository.js';

export class FakeWorkflowRunRepository implements WorkflowRunRepository {
  readonly savedStatusesInOrder: RunStatus[] = [];

  async save(run: WorkflowRun): Promise<void> {
    this.savedStatusesInOrder.push(run.status);
  }
}
