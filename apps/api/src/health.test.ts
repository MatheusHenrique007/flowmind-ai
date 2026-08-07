import { describe, expect, it } from 'vitest';

import { buildHealthReport } from './health.js';

describe('buildHealthReport', () => {
  it('reports ok/configured when every dependency is healthy and credentials are set', () => {
    const report = buildHealthReport({ postgres: 'ok', redis: 'ok' }, 'ok', true, true);

    expect(report).toEqual({
      api: 'ok',
      postgres: 'ok',
      redis: 'ok',
      queue: 'ok',
      anthropic: 'configured',
      slack: 'configured',
    });
  });

  it('reports not_configured for anthropic/slack when their credentials are empty', () => {
    const report = buildHealthReport({ postgres: 'ok', redis: 'ok' }, 'ok', false, false);

    expect(report.anthropic).toBe('not_configured');
    expect(report.slack).toBe('not_configured');
  });

  it('surfaces a dependency failure without touching the others', () => {
    const report = buildHealthReport({ postgres: 'error', redis: 'ok' }, 'ok', true, true);

    expect(report.postgres).toBe('error');
    expect(report.redis).toBe('ok');
  });
});
