import { Schedule, WorkflowId, WorkspaceId } from '@flowmind/domain';
import { describe, expect, it } from 'vitest';

import { ListSchedules } from '../use-cases/list-schedules.js';

import { FakeScheduleRepository } from './fakes/fake-schedule-repository.js';

describe('ListSchedules', () => {
  it('only returns schedules belonging to the given workspace', async () => {
    const repository = new FakeScheduleRepository();
    const workspaceId = WorkspaceId.generate();
    const otherWorkspaceId = WorkspaceId.generate();

    const mine = Schedule.create({
      workflowId: WorkflowId.generate(),
      workspaceId,
      cronExpression: '* * * * *',
    });
    const theirs = Schedule.create({
      workflowId: WorkflowId.generate(),
      workspaceId: otherWorkspaceId,
      cronExpression: '* * * * *',
    });
    repository.seed(mine);
    repository.seed(theirs);

    const result = await new ListSchedules(repository).execute(workspaceId);

    expect(result).toHaveLength(1);
    expect(result[0]?.id.equals(mine.id)).toBe(true);
  });
});
