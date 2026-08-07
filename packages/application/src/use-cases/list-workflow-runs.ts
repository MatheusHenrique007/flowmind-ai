import type { WorkflowRunRepository } from '../ports/workflow-run-repository.js';
import type { WorkflowRunView } from '../ports/workflow-run-view.js';

export class ListWorkflowRuns {
  constructor(private readonly workflowRunRepository: WorkflowRunRepository) {}

  async execute(): Promise<WorkflowRunView[]> {
    return this.workflowRunRepository.listViews();
  }
}
