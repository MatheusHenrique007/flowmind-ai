import { describe, expect, it } from 'vitest';

import { Schedule } from '../entities/schedule.js';
import { InvalidCronExpressionError } from '../errors/invalid-cron-expression-error.js';
import { InvalidIdError } from '../errors/invalid-id-error.js';
import { WorkflowId } from '../value-objects/workflow-id.js';
import { WorkspaceId } from '../value-objects/workspace-id.js';

const workflowId = WorkflowId.generate();
const workspaceId = WorkspaceId.generate();

describe('Schedule', () => {
  it('can be created with a valid cron expression', () => {
    const schedule = Schedule.create({
      workflowId,
      workspaceId,
      cronExpression: '*/5 * * * *',
    });

    expect(schedule.cronExpression).toBe('*/5 * * * *');
    expect(schedule.workflowId.equals(workflowId)).toBe(true);
    expect(schedule.workspaceId.equals(workspaceId)).toBe(true);
    expect(schedule.id).toBeDefined();
    expect(schedule.createdAt).toBeInstanceOf(Date);
  });

  it.each([
    '0 0 * * *',
    '*/1 * * * *',
    '0 9-17 * * 1-5',
    '15,45 * * * *',
    '0 0 1 1 0',
    '0 0 1 1 7',
  ])('accepts valid cron expression "%s"', (cronExpression) => {
    expect(() => Schedule.create({ workflowId, workspaceId, cronExpression })).not.toThrow();
  });

  it.each([
    ['* * * *', 'too few fields'],
    ['* * * * * *', 'too many fields'],
    ['60 * * * *', 'minute out of range'],
    ['* 24 * * *', 'hour out of range'],
    ['* * 0 * *', 'day-of-month out of range'],
    ['* * * 13 *', 'month out of range'],
    ['* * * * 8', 'day-of-week out of range'],
    ['abc * * * *', 'garbage characters'],
    ['', 'empty string'],
    ['   ', 'blank string'],
  ])('rejects invalid cron expression "%s" (%s)', (cronExpression) => {
    expect(() => Schedule.create({ workflowId, workspaceId, cronExpression })).toThrow(
      InvalidCronExpressionError,
    );
  });

  it('rejects a missing workflowId', () => {
    expect(() =>
      Schedule.create({
        workflowId: WorkflowId.create(''),
        workspaceId,
        cronExpression: '* * * * *',
      }),
    ).toThrow(InvalidIdError);
  });

  it('rejects a missing workspaceId', () => {
    expect(() =>
      Schedule.create({
        workflowId,
        workspaceId: WorkspaceId.create(''),
        cronExpression: '* * * * *',
      }),
    ).toThrow(InvalidIdError);
  });
});
