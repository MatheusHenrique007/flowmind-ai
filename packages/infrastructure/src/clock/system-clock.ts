import type { Clock } from '@flowmind/application';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
