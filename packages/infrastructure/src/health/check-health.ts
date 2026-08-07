import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

export interface DependencyHealth {
  postgres: 'ok' | 'error';
  redis: 'ok' | 'error';
}

/**
 * Cheap connectivity probes for the GET /health endpoint — not a business
 * rule, purely operational diagnostics. Never throws: a failed probe is
 * reported as 'error', not an unhandled rejection.
 */
export async function checkHealth(prisma: PrismaClient, redis: Redis): Promise<DependencyHealth> {
  const [postgres, redisStatus] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then((): 'ok' => 'ok').catch((): 'error' => 'error'),
    redis
      .ping()
      .then((): 'ok' => 'ok')
      .catch((): 'error' => 'error'),
  ]);

  return { postgres, redis: redisStatus };
}
