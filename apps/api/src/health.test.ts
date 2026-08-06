import { describe, expect, it } from 'vitest';

import { getHealthStatus } from './health.js';

describe('getHealthStatus', () => {
  it('returns an ok status payload', () => {
    expect(getHealthStatus()).toEqual({ status: 'ok' });
  });
});
