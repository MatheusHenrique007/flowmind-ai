/**
 * Pure health-check payload builder — kept side-effect free so it can be
 * unit tested without booting the Fastify server.
 */
export function getHealthStatus(): { status: 'ok' } {
  return { status: 'ok' };
}
