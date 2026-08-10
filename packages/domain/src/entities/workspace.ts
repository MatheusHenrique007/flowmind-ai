import { InvalidWorkspaceError } from '../errors/invalid-workspace-error.js';
import type { UserId } from '../value-objects/user-id.js';
import { WorkspaceId } from '../value-objects/workspace-id.js';

/**
 * The tenant boundary. Exactly one Workspace per User this release (created
 * together, atomically, by RegisterUser) — no teams, no invites, no multiple
 * workspaces. Trivial on purpose: it exists so `Workflow.workspaceId` has
 * something real to point at, not to model organizations.
 */
export class Workspace {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly ownerUserId: UserId;
  readonly createdAt: Date;

  private constructor(id: WorkspaceId, name: string, ownerUserId: UserId, createdAt: Date) {
    this.id = id;
    this.name = name;
    this.ownerUserId = ownerUserId;
    this.createdAt = createdAt;
  }

  static create(params: {
    id?: WorkspaceId;
    name: string;
    ownerUserId: UserId;
    createdAt?: Date;
  }): Workspace {
    const name = params.name.trim();
    if (name.length === 0) {
      throw new InvalidWorkspaceError('name must not be empty.');
    }

    return new Workspace(
      params.id ?? WorkspaceId.generate(),
      name,
      params.ownerUserId,
      params.createdAt ?? new Date(),
    );
  }
}
