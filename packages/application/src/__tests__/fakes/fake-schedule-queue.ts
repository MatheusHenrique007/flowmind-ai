import type { Schedule, ScheduleId } from '@flowmind/domain';

import type { ScheduleQueue } from '../../ports/schedule-queue.js';

export class FakeScheduleQueue implements ScheduleQueue {
  readonly registered = new Map<string, Schedule>();
  shouldFailRegister = false;
  shouldFailUnregister = false;

  async register(schedule: Schedule): Promise<void> {
    if (this.shouldFailRegister) {
      throw new Error('simulated queue registration failure');
    }
    this.registered.set(schedule.id.value, schedule);
  }

  async unregister(scheduleId: ScheduleId): Promise<void> {
    if (this.shouldFailUnregister) {
      throw new Error('simulated queue unregistration failure');
    }
    this.registered.delete(scheduleId.value);
  }
}
