import type { DependencyHealth } from '@flowmind/infrastructure';

import type { HealthReport } from './composition-root.js';

/**
 * Pure health-report builder — kept side-effect free so it can be unit
 * tested without booting Fastify or hitting a real Postgres/Redis. The
 * actual I/O (pinging Postgres/Redis/the queue) happens in
 * composition-root.ts's checkHealth, which calls this with the results.
 */
export function buildHealthReport(
  dependencies: DependencyHealth,
  queue: 'ok' | 'error',
  anthropicConfigured: boolean,
  slackConfigured: boolean,
): HealthReport {
  return {
    api: 'ok',
    postgres: dependencies.postgres,
    redis: dependencies.redis,
    queue,
    anthropic: anthropicConfigured ? 'configured' : 'not_configured',
    slack: slackConfigured ? 'configured' : 'not_configured',
  };
}
