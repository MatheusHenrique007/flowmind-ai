import type { UserRepository } from '@flowmind/application';
import { Email, PasswordHash, User, UserId, WorkspaceId } from '@flowmind/domain';
import type { PrismaClient, User as UserRow } from '@prisma/client';

/**
 * The only place allowed to import @prisma/client for User persistence.
 * Stores `passwordHash.value` — the scrypt-derived string — and never sees a
 * plaintext password, which the Domain value object does not expose anyway.
 */
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.value } });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: UserId): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: user.id.value },
      create: {
        id: user.id.value,
        email: user.email.value,
        passwordHash: user.passwordHash.value,
        workspaceId: user.workspaceId.value,
        createdAt: user.createdAt,
      },
      update: {
        email: user.email.value,
        passwordHash: user.passwordHash.value,
      },
    });
  }

  private toDomain(row: UserRow): User {
    return User.create({
      id: UserId.create(row.id),
      email: Email.create(row.email),
      passwordHash: PasswordHash.fromStored(row.passwordHash),
      workspaceId: WorkspaceId.create(row.workspaceId),
      createdAt: row.createdAt,
    });
  }
}
