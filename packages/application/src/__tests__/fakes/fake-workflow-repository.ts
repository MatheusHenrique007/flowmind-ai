import type { Workflow, WorkflowId, WorkspaceId } from '@flowmind/domain';

import type { WorkflowRepository } from '../../ports/workflow-repository.js';

export class FakeWorkflowRepository implements WorkflowRepository {
  private readonly workflows = new Map<string, Workflow>();

  seed(workflow: Workflow): void {
    this.workflows.set(workflow.id.value, workflow);
  }

  /**
   * Mirrors the real repository's isolation rule exactly: a workflow owned by
   * another workspace is reported as missing, not as forbidden — a fake that
   * ignored workspaceId would make the isolation tests pass vacuously.
   */
  async findById(id: WorkflowId, workspaceId: WorkspaceId): Promise<Workflow | null> {
    const workflow = this.workflows.get(id.value);
    if (!workflow || !workflow.workspaceId.equals(workspaceId)) {
      return null;
    }
    return workflow;
  }

  async save(workflow: Workflow): Promise<void> {
    this.workflows.set(workflow.id.value, workflow);
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<Workflow[]> {
    return [...this.workflows.values()].filter((w) => w.workspaceId.equals(workspaceId));
  }
}
