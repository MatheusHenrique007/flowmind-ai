import type { Workflow, WorkspaceId } from '@flowmind/domain';

import type { WorkflowRepository } from '../ports/workflow-repository.js';

/**
 * Thin passthrough to WorkflowRepository.listByWorkspace, mirroring
 * ListSchedules's exact style.
 */
export class ListWorkflows {
  constructor(private readonly workflowRepository: WorkflowRepository) {}

  /** Only ever returns workflows belonging to `workspaceId`. */
  async execute(workspaceId: WorkspaceId): Promise<Workflow[]> {
    return this.workflowRepository.listByWorkspace(workspaceId);
  }
}
