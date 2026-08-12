import type { Workflow, WorkflowId, WorkspaceId } from '@flowmind/domain';

export interface WorkflowRepository {
  /**
   * Scoped by workspace, not just by id. A workflow that exists but belongs to
   * another workspace returns `null` — the same answer as a nonexistent id —
   * so cross-tenant access is indistinguishable from a 404 and cannot be used
   * to enumerate ids (ADR-0004).
   */
  findById(id: WorkflowId, workspaceId: WorkspaceId): Promise<Workflow | null>;
  /** The workspace is taken from the Workflow itself, which always carries one. */
  save(workflow: Workflow): Promise<void>;
  /** Only ever returns workflows belonging to `workspaceId`. */
  listByWorkspace(workspaceId: WorkspaceId): Promise<Workflow[]>;
}
