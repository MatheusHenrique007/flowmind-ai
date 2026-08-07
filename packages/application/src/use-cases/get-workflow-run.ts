import type { WorkflowRunId } from '@flowmind/domain';

import { WorkflowRunNotFoundError } from '../errors/workflow-run-not-found-error.js';
import type { WorkflowRunRepository } from '../ports/workflow-run-repository.js';
import type { WorkflowRunView } from '../ports/workflow-run-view.js';

export class GetWorkflowRun {
  constructor(private readonly workflowRunRepository: WorkflowRunRepository) {}

  async execute(workflowRunId: WorkflowRunId): Promise<WorkflowRunView> {
    const view = await this.workflowRunRepository.findViewById(workflowRunId);
    if (!view) {
      throw new WorkflowRunNotFoundError(workflowRunId);
    }
    return view;
  }
}
