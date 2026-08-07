import { PrismaClient } from '@prisma/client';

/**
 * The only factory allowed to construct a PrismaClient — Presentation
 * (apps/api's composition root) calls this instead of importing
 * @prisma/client directly, so the Prisma dependency stays confined to this
 * package end to end.
 */
export function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}
