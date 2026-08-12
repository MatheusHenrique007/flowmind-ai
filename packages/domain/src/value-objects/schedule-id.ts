import { EntityId } from './entity-id.js';

export class ScheduleId extends EntityId {
  private constructor(value: string) {
    super(value, 'ScheduleId');
  }

  static create(value: string): ScheduleId {
    return new ScheduleId(value);
  }

  static generate(): ScheduleId {
    return new ScheduleId(EntityId.generateValue());
  }
}
