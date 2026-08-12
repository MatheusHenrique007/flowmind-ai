import type { RefreshTokenRepository } from '@flowmind/application';
import { RefreshToken, RefreshTokenId, TokenFamilyId, UserId } from '@flowmind/domain';
import type { PrismaClient, RefreshToken as RefreshTokenRow } from '@prisma/client';

/**
 * The only place allowed to import @prisma/client for refresh-token
 * persistence. Nothing here ever touches a raw token value — the domain hands
 * over an already-hashed `tokenHash`, and lookups are by hash too.
 */
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(token: RefreshToken): Promise<void> {
    await this.prisma.refreshToken.upsert({
      where: { id: token.id.value },
      create: {
        id: token.id.value,
        userId: token.userId.value,
        tokenHash: token.tokenHash,
        familyId: token.familyId.value,
        expiresAt: token.expiresAt,
        revokedAt: token.revokedAt ?? null,
        createdAt: token.createdAt,
      },
      update: { revokedAt: token.revokedAt ?? null },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    return row ? this.toDomain(row) : null;
  }

  /**
   * A single UPDATE rather than load-modify-save per row: family revocation is
   * the reaction to a suspected stolen token, so it must be atomic and must not
   * race another concurrent refresh. `revokedAt: null` in the filter keeps
   * earlier revocation timestamps intact.
   */
  async revokeFamily(familyId: TokenFamilyId, revokedAt: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId: familyId.value, revokedAt: null },
      data: { revokedAt },
    });
  }

  private toDomain(row: RefreshTokenRow): RefreshToken {
    return RefreshToken.create({
      id: RefreshTokenId.create(row.id),
      userId: UserId.create(row.userId),
      tokenHash: row.tokenHash,
      familyId: TokenFamilyId.create(row.familyId),
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt ?? undefined,
    });
  }
}
