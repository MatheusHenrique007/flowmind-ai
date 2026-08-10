import type { Clock } from '../../ports/clock.js';

/**
 * Deterministic Clock that only moves when a test moves it — refresh-token
 * expiry assertions need to control "now" exactly, not have it drift by a
 * fixed step per read (unlike the Engine's FakeClock, which does).
 */
export class FakeClock implements Clock {
  private current: number;

  constructor(start: Date = new Date('2026-08-10T12:00:00.000Z')) {
    this.current = start.getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  advanceDays(days: number): void {
    this.current += days * 24 * 60 * 60 * 1000;
  }
}
