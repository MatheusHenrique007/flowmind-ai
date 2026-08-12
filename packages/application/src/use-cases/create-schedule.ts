import { Schedule, WorkflowId, type WorkspaceId } from '@flowmind/domain';

import { MAX_SCHEDULES_PER_WORKSPACE } from '../errors/schedule-limit-exceeded-error.js';
import { ScheduleLimitExceededError } from '../errors/schedule-limit-exceeded-error.js';
import { ScheduleRegistrationFailedError } from '../errors/schedule-registration-failed-error.js';
import { WorkflowNotFoundError } from '../errors/workflow-not-found-error.js';
import type { ScheduleQueue } from '../ports/schedule-queue.js';
import type { ScheduleRepository } from '../ports/schedule-repository.js';
import type { WorkflowRepository } from '../ports/workflow-repository.js';

export interface CreateScheduleInput {
  workflowId: string;
  cronExpression: string;
}

/**
 * Persists a Schedule to Postgres FIRST, then registers it with the queue
 * backend. If registration fails, best-effort compensates by deleting the
 * just-created row (swallowing a compensation failure — it must never mask
 * the original error) and rethrows ScheduleRegistrationFailedError.
 *
 * This ordering is deliberate, not incidental: the worst outcome this
 * strategy must avoid is an active recurring queue job with no Postgres row
 * to trace or stop it. Persisting first means that can never happen — the
 * residual failure mode (compensation itself fails) only ever leaves a
 * harmless orphan DB row with no matching queue registration. See ADR-0006.
 */
export class CreateSchedule {
  constructor(
    private readonly scheduleRepository: ScheduleRepository,
    private readonly scheduleQueue: ScheduleQueue,
    private readonly workflowRepository: WorkflowRepository,
  ) {}

  async execute(workspaceId: WorkspaceId, input: CreateScheduleInput): Promise<Schedule> {
    const existingCount = await this.scheduleRepository.countByWorkspace(workspaceId);
    if (existingCount >= MAX_SCHEDULES_PER_WORKSPACE) {
      throw new ScheduleLimitExceededError(workspaceId);
    }

    const workflowId = WorkflowId.create(input.workflowId);
    const workflow = await this.workflowRepository.findById(workflowId, workspaceId);
    if (!workflow) {
      throw new WorkflowNotFoundError(workflowId);
    }

    const schedule = Schedule.create({
      workflowId,
      workspaceId,
      cronExpression: input.cronExpression,
    });

    await this.scheduleRepository.save(schedule);

    try {
      await this.scheduleQueue.register(schedule);
    } catch (cause) {
      await this.scheduleRepository.delete(schedule.id, workspaceId).catch(() => {
        // Best-effort compensation only — a failure here must not mask the
        // original registration error, and only leaves a harmless orphan row.
      });
      throw new ScheduleRegistrationFailedError(cause);
    }

    return schedule;
  }
}
