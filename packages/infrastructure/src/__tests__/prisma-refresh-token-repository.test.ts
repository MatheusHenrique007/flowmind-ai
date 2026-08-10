import {
  Email,
  PasswordHash,
  RefreshToken,
  RefreshTokenSecret,
  TokenFamilyId,
  User,
  UserId,
  Workspace,
  WorkspaceId,
} from '@flowmind/domain';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaRefreshTokenRepository } from '../persistence/prisma-refresh-token-repository.js';
import { PrismaWorkspaceRepository } from '../persistence/prisma-workspace-repository.js';

const NOW = new Date('2026-08-10T12:00:00.000Z');
const LATER = new Date('2026-08-17T12:00:00.000Z');

describe.skipIf(!process.env.DATABASE_URL)('PrismaRefreshTokenRepository', () => {
  const prisma = new PrismaClient();
  const repository = new PrismaRefreshTokenRepository(prisma);
  const workspaces = new PrismaWorkspaceRepository(prisma);
  const userId = UserId.generate();
  const workspaceId = WorkspaceId.generate();

  beforeAll(async () => {
    const user = User.create({
      id: userId,
      email: Email.create(`tokens-${userId.value}@example.com`),
      passwordHash: await PasswordHash.hash('correct horse battery'),
      workspaceId,
    });
    await workspaces.createWithOwner(
      Workspace.create({ id: workspaceId, name: 'Token test workspace', ownerUserId: userId }),
      user,
    );
  });

  afterAll(async () => {
    // refresh_tokens cascade from users; delete explicitly anyway so a schema
    // change to the cascade rule cannot silently leave rows behind.
    await prisma.refreshToken.deleteMany({ where: { userId: userId.value } });
    await prisma.user.deleteMany({ where: { id: userId.value } });
    await prisma.workspace.deleteMany({ where: { id: workspaceId.value } });
    await prisma.$disconnect();
  });

  async function issue(familyId: TokenFamilyId): Promise<{ raw: string; token: RefreshToken }> {
    const secret = RefreshTokenSecret.generate();
    const token = RefreshToken.create({
      userId,
      tokenHash: secret.hash,
      familyId,
      expiresAt: LATER,
      createdAt: NOW,
    });
    await repository.save(token);
    return { raw: secret.value, token };
  }

  it('returns null for a token hash that was never issued', async () => {
    await expect(repository.findByTokenHash('0'.repeat(64))).resolves.toBeNull();
  });

  it('stores only the hash — the raw token value is nowhere in the row', async () => {
    const { raw, token } = await issue(TokenFamilyId.generate());

    const row = await prisma.refreshToken.findUniqueOrThrow({ where: { id: token.id.value } });
    expect(row.tokenHash).not.toBe(raw);
    expect(row.tokenHash).toBe(RefreshTokenSecret.hashOf(raw));
    expect(JSON.stringify(row)).not.toContain(raw);
  });

  it('finds an issued token by the hash of the presented raw value', async () => {
    const { raw, token } = await issue(TokenFamilyId.generate());

    const found = await repository.findByTokenHash(RefreshTokenSecret.hashOf(raw));

    expect(found?.id.value).toBe(token.id.value);
    expect(found?.isActive(NOW)).toBe(true);
  });

  it('persists a revocation so the token is no longer active when reloaded', async () => {
    const { raw, token } = await issue(TokenFamilyId.generate());

    token.revoke(NOW);
    await repository.save(token);

    const reloaded = await repository.findByTokenHash(RefreshTokenSecret.hashOf(raw));
    expect(reloaded?.isRevoked()).toBe(true);
    expect(reloaded?.isActive(NOW)).toBe(false);
  });

  it('revokeFamily revokes every token in that family and leaves other families alone', async () => {
    const family = TokenFamilyId.generate();
    const otherFamily = TokenFamilyId.generate();
    const first = await issue(family);
    const second = await issue(family);
    const unrelated = await issue(otherFamily);

    await repository.revokeFamily(family, NOW);

    for (const raw of [first.raw, second.raw]) {
      const reloaded = await repository.findByTokenHash(RefreshTokenSecret.hashOf(raw));
      expect(reloaded?.isRevoked()).toBe(true);
    }
    const untouched = await repository.findByTokenHash(RefreshTokenSecret.hashOf(unrelated.raw));
    expect(untouched?.isRevoked()).toBe(false);
  });

  it('revokeFamily keeps an earlier revocation timestamp instead of overwriting it', async () => {
    const family = TokenFamilyId.generate();
    const { raw, token } = await issue(family);
    token.revoke(NOW);
    await repository.save(token);

    await repository.revokeFamily(family, LATER);

    const reloaded = await repository.findByTokenHash(RefreshTokenSecret.hashOf(raw));
    expect(reloaded?.revokedAt).toEqual(NOW);
  });
});
