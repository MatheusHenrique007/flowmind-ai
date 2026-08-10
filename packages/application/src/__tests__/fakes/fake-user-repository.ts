import type { Email, User, UserId, Workspace } from '@flowmind/domain';

import type { UserRepository } from '../../ports/user-repository.js';
import type { WorkspaceRepository } from '../../ports/workspace-repository.js';

/**
 * Backs both UserRepository and WorkspaceRepository off one in-memory store so
 * `createWithOwner` can behave the way the real (transactional) implementation
 * does: both rows appear together or neither does.
 */
export class FakeAccountStore {
  readonly users = new Map<string, User>();
  readonly workspaces = new Map<string, Workspace>();

  readonly userRepository: UserRepository = {
    findByEmail: async (email: Email) =>
      [...this.users.values()].find((user) => user.email.equals(email)) ?? null,
    findById: async (id: UserId) => this.users.get(id.value) ?? null,
    save: async (user: User) => {
      this.users.set(user.id.value, user);
    },
  };

  readonly workspaceRepository: WorkspaceRepository = {
    findById: async (id) => this.workspaces.get(id.value) ?? null,
    save: async (workspace: Workspace) => {
      this.workspaces.set(workspace.id.value, workspace);
    },
    createWithOwner: async (workspace: Workspace, owner: User) => {
      this.workspaces.set(workspace.id.value, workspace);
      this.users.set(owner.id.value, owner);
    },
  };
}
