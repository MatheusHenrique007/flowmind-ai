import { Redis } from 'ioredis';

/**
 * The only factory allowed to construct a Redis connection — Presentation
 * calls this instead of importing ioredis directly. `maxRetriesPerRequest:
 * null` is required by BullMQ when a Worker/Queue is given a real
 * connection instance rather than bare options.
 */
export function createRedisConnection(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null });
}
