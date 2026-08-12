import type { WorkspaceId } from '@flowmind/domain';
import type { PrismaClient } from '@prisma/client';

/**
 * Integration tests create their own throwaway Workspace rather than reusing
 * any existing row, so they can never touch (or delete) real or pre-existing
 * data when run against a shared database — the same discipline the existing
 * suites already follow for Workflow rows.
 *
 * `ownerUserId` is a placeholder: Workspace.ownerUserId is deliberately not a
 * foreign key (see prisma/schema.prisma), so no User row is required.
 */
export async function createTestWorkspace(
  prisma: PrismaClient,
  workspaceId: WorkspaceId,
): Promise<void> {
  await prisma.workspace.create({
    data: {
      id: workspaceId.value,
      name: `Integration test workspace ${workspaceId.value}`,
      ownerUserId: 'integration-test',
    },
  });
}

/** Only ever deletes a workspace this suite created, and only once it is empty. */
export async function deleteTestWorkspace(
  prisma: PrismaClient,
  workspaceId: WorkspaceId,
): Promise<void> {
  await prisma.workspace.deleteMany({ where: { id: workspaceId.value } });
}
