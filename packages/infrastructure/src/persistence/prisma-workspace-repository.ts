import type { WorkspaceRepository } from '@flowmind/application';
import { UserId, Workspace, WorkspaceId, type User } from '@flowmind/domain';
import type { PrismaClient, Workspace as WorkspaceRow } from '@prisma/client';

/**
 * The only place allowed to import @prisma/client for Workspace persistence.
 */
export class PrismaWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: WorkspaceId): Promise<Workspace | null> {
    const row = await this.prisma.workspace.findUnique({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async save(workspace: Workspace): Promise<void> {
    await this.prisma.workspace.upsert({
      where: { id: workspace.id.value },
      create: {
        id: workspace.id.value,
        name: workspace.name,
        ownerUserId: workspace.ownerUserId.value,
        createdAt: workspace.createdAt,
      },
      update: { name: workspace.name },
    });
  }

  /**
   * One Prisma transaction, so registration cannot leave an orphan Workspace
   * or a User referencing a Workspace that was never committed. The Workspace
   * row goes first because `users.workspaceId` is a real foreign key (while
   * `workspaces.ownerUserId` deliberately is not — see schema.prisma).
   */
  async createWithOwner(workspace: Workspace, owner: User): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.workspace.create({
        data: {
          id: workspace.id.value,
          name: workspace.name,
          ownerUserId: workspace.ownerUserId.value,
          createdAt: workspace.createdAt,
        },
      }),
      this.prisma.user.create({
        data: {
          id: owner.id.value,
          email: owner.email.value,
          passwordHash: owner.passwordHash.value,
          workspaceId: owner.workspaceId.value,
          createdAt: owner.createdAt,
        },
      }),
    ]);
  }

  private toDomain(row: WorkspaceRow): Workspace {
    return Workspace.create({
      id: WorkspaceId.create(row.id),
      name: row.name,
      ownerUserId: UserId.create(row.ownerUserId),
      createdAt: row.createdAt,
    });
  }
}
