import type { User, Workspace, WorkspaceId } from '@flowmind/domain';

export interface WorkspaceRepository {
  findById(id: WorkspaceId): Promise<Workspace | null>;
  save(workspace: Workspace): Promise<void>;

  /**
   * Persists a Workspace and its owning User in a single transaction.
   *
   * The PRD requires registration to create both "atomically" while listing
   * `WorkspaceRepository` as `findById`/`save` only — two independent `save`
   * calls cannot express that (a crash between them leaves an orphan
   * Workspace, or a User pointing at a Workspace that was never committed).
   * This method is the transactional boundary that requirement needs; the
   * transaction itself is Infrastructure's business, Application only knows
   * that both rows land together or neither does.
   */
  createWithOwner(workspace: Workspace, owner: User): Promise<void>;
}
