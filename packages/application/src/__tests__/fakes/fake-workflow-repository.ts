import type { Workflow, WorkflowId } from '@flowmind/domain';

import type { WorkflowRepository } from '../../ports/workflow-repository.js';

export class FakeWorkflowRepository implements WorkflowRepository {
  private readonly workflows = new Map<string, Workflow>();

  seed(workflow: Workflow): void {
    this.workflows.set(workflow.id.value, workflow);
  }

  async findById(id: WorkflowId): Promise<Workflow | null> {
    return this.workflows.get(id.value) ?? null;
  }
}
