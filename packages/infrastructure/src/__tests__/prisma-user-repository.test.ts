import { Email, PasswordHash, User, UserId, Workspace, WorkspaceId } from '@flowmind/domain';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { PrismaUserRepository } from '../persistence/prisma-user-repository.js';
import { PrismaWorkspaceRepository } from '../persistence/prisma-workspace-repository.js';

/**
 * Real integration test against Postgres — skips gracefully without
 * DATABASE_URL rather than pretending to pass. Creates only its own
 * uniquely-id'd rows and removes exactly those, so it can run against a shared
 * database without touching anyone else's (or the pre-existing legacy) data.
 */
describe.skipIf(!process.env.DATABASE_URL)('PrismaUserRepository', () => {
  const prisma = new PrismaClient();
  const users = new PrismaUserRepository(prisma);
  const workspaces = new PrismaWorkspaceRepository(prisma);
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

  async function register(emailAddress: string): Promise<User> {
    const userId = UserId.generate();
    const workspaceId = WorkspaceId.generate();
    const user = User.create({
      id: userId,
      email: Email.create(emailAddress),
      passwordHash: await PasswordHash.hash('correct horse battery'),
      workspaceId,
    });
    await workspaces.createWithOwner(
      Workspace.create({ id: workspaceId, name: 'Test workspace', ownerUserId: userId }),
      user,
    );
    createdUserIds.push(userId.value);
    createdWorkspaceIds.push(workspaceId.value);
    return user;
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } });
    await prisma.$disconnect();
  });

  it('returns null for an email that has no account', async () => {
    await expect(users.findByEmail(Email.create('nobody-here@example.com'))).resolves.toBeNull();
  });

  it('returns null for a user id that does not exist', async () => {
    await expect(users.findById(UserId.generate())).resolves.toBeNull();
  });

  it('creates the workspace and its owner in one transaction and reads the user back', async () => {
    const created = await register(`owner-${UserId.generate().value}@example.com`);

    const reloaded = await users.findById(created.id);

    expect(reloaded).not.toBeNull();
    expect(reloaded?.email.value).toBe(created.email.value);
    expect(reloaded?.workspaceId.value).toBe(created.workspaceId.value);
    await expect(workspaces.findById(created.workspaceId)).resolves.not.toBeNull();
  });

  it('persists the password as a verifiable scrypt hash, never as plaintext', async () => {
    const created = await register(`hash-${UserId.generate().value}@example.com`);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: created.id.value } });
    expect(row.passwordHash).not.toContain('correct horse battery');
    expect(row.passwordHash.startsWith('scrypt$')).toBe(true);

    const reloaded = await users.findById(created.id);
    await expect(reloaded?.verifyPassword('correct horse battery')).resolves.toBe(true);
    await expect(reloaded?.verifyPassword('wrong password')).resolves.toBe(false);
  });

  it('finds a user by email', async () => {
    const created = await register(`by-email-${UserId.generate().value}@example.com`);

    const found = await users.findByEmail(created.email);

    expect(found?.id.value).toBe(created.id.value);
  });

  it('refuses a second account with the same email (unique index enforced in the database)', async () => {
    const created = await register(`dup-${UserId.generate().value}@example.com`);

    const secondUserId = UserId.generate();
    const secondWorkspaceId = WorkspaceId.generate();
    const duplicate = User.create({
      id: secondUserId,
      email: created.email,
      passwordHash: await PasswordHash.hash('another password'),
      workspaceId: secondWorkspaceId,
    });

    await expect(
      workspaces.createWithOwner(
        Workspace.create({
          id: secondWorkspaceId,
          name: 'Second workspace',
          ownerUserId: secondUserId,
        }),
        duplicate,
      ),
    ).rejects.toThrow();

    // The transaction rolled back: no orphan workspace was left behind.
    await expect(workspaces.findById(secondWorkspaceId)).resolves.toBeNull();
  });
});
