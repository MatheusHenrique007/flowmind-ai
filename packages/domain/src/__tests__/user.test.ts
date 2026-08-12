import { describe, expect, it } from 'vitest';

import { User } from '../entities/user.js';
import { Workspace } from '../entities/workspace.js';
import { InvalidWorkspaceError } from '../errors/invalid-workspace-error.js';
import { Email } from '../value-objects/email.js';
import { PasswordHash } from '../value-objects/password-hash.js';
import { UserId } from '../value-objects/user-id.js';
import { WorkspaceId } from '../value-objects/workspace-id.js';

describe('User', () => {
  it('verifies its own password through the PasswordHash value object', async () => {
    const user = User.create({
      email: Email.create('user@example.com'),
      passwordHash: await PasswordHash.hash('correct horse battery'),
      workspaceId: WorkspaceId.generate(),
    });

    await expect(user.verifyPassword('correct horse battery')).resolves.toBe(true);
    await expect(user.verifyPassword('wrong')).resolves.toBe(false);
  });

  it('belongs to exactly the workspace it was created with', async () => {
    const workspaceId = WorkspaceId.generate();
    const user = User.create({
      email: Email.create('user@example.com'),
      passwordHash: await PasswordHash.hash('correct horse battery'),
      workspaceId,
    });

    expect(user.workspaceId.equals(workspaceId)).toBe(true);
  });
});

describe('Workspace', () => {
  it('is created with a trimmed name and an owning user', () => {
    const ownerUserId = UserId.generate();
    const workspace = Workspace.create({ name: '  Acme  ', ownerUserId });

    expect(workspace.name).toBe('Acme');
    expect(workspace.ownerUserId.equals(ownerUserId)).toBe(true);
  });

  it('rejects a blank name', () => {
    expect(() => Workspace.create({ name: '   ', ownerUserId: UserId.generate() })).toThrow(
      InvalidWorkspaceError,
    );
  });
});
