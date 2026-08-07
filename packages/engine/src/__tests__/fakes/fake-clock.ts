import type { Clock } from '@flowmind/application';

/**
 * Deterministic Clock — each call to now() advances by a fixed step, so
 * durationMs in tests is predictable instead of depending on real wall time.
 */
export class FakeClock implements Clock {
  private current: number;

  constructor(
    startMs = Date.parse('2026-01-01T00:00:00.000Z'),
    private readonly stepMs = 100,
  ) {
    this.current = startMs;
  }

  now(): Date {
    const date = new Date(this.current);
    this.current += this.stepMs;
    return date;
  }
}
