import {
  DestinationKind,
  InvalidCronExpressionError,
  Provider,
  Schedule,
  Workflow,
  WorkflowStep,
  WorkspaceId,
} from '@flowmind/domain';
import { describe, expect, it } from 'vitest';

import { ScheduleLimitExceededError } from '../errors/schedule-limit-exceeded-error.js';
import { ScheduleRegistrationFailedError } from '../errors/schedule-registration-failed-error.js';
import { WorkflowNotFoundError } from '../errors/workflow-not-found-error.js';
import { CreateSchedule } from '../use-cases/create-schedule.js';

import { FakeScheduleQueue } from './fakes/fake-schedule-queue.js';
import { FakeScheduleRepository } from './fakes/fake-schedule-repository.js';
import { FakeWorkflowRepository } from './fakes/fake-workflow-repository.js';

const workspaceId = WorkspaceId.generate();

function seededWorkflow(ws = workspaceId) {
  return Workflow.create({
    name: 'Webhook to Slack',
    steps: [
      WorkflowStep.trigger({ kind: 'webhook' }),
      WorkflowStep.ai({ provider: Provider.CLAUDE, instruction: 'Summarize.' }),
      WorkflowStep.destination({ destination: DestinationKind.SLACK, target: '#alerts' }),
    ],
    workspaceId: ws,
  });
}

function buildUseCase() {
  const scheduleRepository = new FakeScheduleRepository();
  const scheduleQueue = new FakeScheduleQueue();
  const workflowRepository = new FakeWorkflowRepository();
  const useCase = new CreateSchedule(scheduleRepository, scheduleQueue, workflowRepository);
  return { scheduleRepository, scheduleQueue, workflowRepository, useCase };
}

describe('CreateSchedule', () => {
  it('creates and registers a schedule for an existing workflow', async () => {
    const { scheduleRepository, scheduleQueue, workflowRepository, useCase } = buildUseCase();
    const workflow = seededWorkflow();
    workflowRepository.seed(workflow);

    const schedule = await useCase.execute(workspaceId, {
      workflowId: workflow.id.value,
      cronExpression: '*/5 * * * *',
    });

    expect(schedule.cronExpression).toBe('*/5 * * * *');
    await expect(scheduleRepository.findById(schedule.id, workspaceId)).resolves.toBe(schedule);
    expect(scheduleQueue.registered.has(schedule.id.value)).toBe(true);
  });

  it('rejects at exactly the 20-schedule limit', async () => {
    const { scheduleRepository, workflowRepository, useCase } = buildUseCase();
    const workflow = seededWorkflow();
    workflowRepository.seed(workflow);
    for (let i = 0; i < 20; i++) {
      scheduleRepository.seed(
        Schedule.create({
          workflowId: workflow.id,
          workspaceId,
          cronExpression: '0 0 * * *',
        }),
      );
    }
    await expect(scheduleRepository.countByWorkspace(workspaceId)).resolves.toBe(20);

    await expect(
      useCase.execute(workspaceId, { workflowId: workflow.id.value, cronExpression: '* * * * *' }),
    ).rejects.toThrow(ScheduleLimitExceededError);
  });

  it('throws WorkflowNotFoundError when the workflow does not exist', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute(workspaceId, {
        workflowId: '00000000-0000-0000-0000-000000000000',
        cronExpression: '* * * * *',
      }),
    ).rejects.toThrow(WorkflowNotFoundError);
  });

  it('treats a workflow belonging to another workspace as not found (cross-tenant)', async () => {
    const { workflowRepository, useCase } = buildUseCase();
    const otherWorkspaceId = WorkspaceId.generate();
    const workflow = seededWorkflow(otherWorkspaceId);
    workflowRepository.seed(workflow);

    await expect(
      useCase.execute(workspaceId, { workflowId: workflow.id.value, cronExpression: '* * * * *' }),
    ).rejects.toThrow(WorkflowNotFoundError);
  });

  it('propagates domain cron validation errors', async () => {
    const { workflowRepository, useCase } = buildUseCase();
    const workflow = seededWorkflow();
    workflowRepository.seed(workflow);

    await expect(
      useCase.execute(workspaceId, { workflowId: workflow.id.value, cronExpression: 'garbage' }),
    ).rejects.toThrow(InvalidCronExpressionError);
  });

  it('compensates by deleting the Postgres row when queue registration fails, then surfaces ScheduleRegistrationFailedError', async () => {
    const { scheduleRepository, scheduleQueue, workflowRepository, useCase } = buildUseCase();
    const workflow = seededWorkflow();
    workflowRepository.seed(workflow);
    scheduleQueue.shouldFailRegister = true;

    await expect(
      useCase.execute(workspaceId, { workflowId: workflow.id.value, cronExpression: '* * * * *' }),
    ).rejects.toThrow(ScheduleRegistrationFailedError);

    await expect(scheduleRepository.listByWorkspace(workspaceId)).resolves.toHaveLength(0);
  });
});
