import {
  ScheduleLimitExceededError,
  ScheduleNotFoundError,
  ScheduleRegistrationFailedError,
  WorkflowNotFoundError,
  type CreateSchedule,
  type DeleteSchedule,
  type ListSchedules,
} from '@flowmind/application';
import { InvalidCronExpressionError, ScheduleId } from '@flowmind/domain';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { ZodError, z } from 'zod';

import { authOf } from '../auth/require-auth.js';

const createScheduleSchema = z.object({
  workflowId: z.string().min(1),
  cronExpression: z.string().min(1),
});

function isValidationError(error: unknown): error is Error {
  return error instanceof ZodError || error instanceof InvalidCronExpressionError;
}

/**
 * Presentation only: parses/validates the request shape with Zod and maps
 * application errors to the right HTTP status — the use cases themselves
 * know nothing about HTTP.
 *
 * The workspace always comes from the verified access token (`authOf`),
 * never from the request body: the input schema has no workspaceId field, so
 * a client cannot even express "create this in someone else's workspace",
 * and a workflowId belonging to another workspace produces 404 (via
 * WorkflowNotFoundError), never 403 — matching workflows.ts (ADR-0004).
 *
 * No timezone support this release: cron expressions are interpreted in UTC
 * only (see ADR-0006). nextRunAt is attached here, one layer above
 * ListSchedules, by calling Infrastructure's computeNextRunAt directly —
 * BullMQ job-scheduler state is not something the Application layer's
 * ScheduleRepository (a Postgres-only port) can answer.
 */
export async function registerScheduleRoutes(
  app: FastifyInstance,
  deps: {
    createSchedule: CreateSchedule;
    listSchedules: ListSchedules;
    deleteSchedule: DeleteSchedule;
    computeNextRunAt: (scheduleId: string) => Promise<Date | null>;
    requireAuth: preHandlerAsyncHookHandler;
  },
): Promise<void> {
  app.post('/schedules', { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const input = createScheduleSchema.parse(request.body);
      const schedule = await deps.createSchedule.execute(authOf(request).workspaceId, input);
      const nextRunAt = await deps.computeNextRunAt(schedule.id.value);
      return reply.status(201).send({
        id: schedule.id.value,
        workflowId: schedule.workflowId.value,
        workspaceId: schedule.workspaceId.value,
        cronExpression: schedule.cronExpression,
        createdAt: schedule.createdAt,
        nextRunAt,
      });
    } catch (error) {
      if (error instanceof WorkflowNotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      if (error instanceof ScheduleLimitExceededError) {
        return reply.status(409).send({ error: error.message });
      }
      if (error instanceof ScheduleRegistrationFailedError) {
        return reply.status(502).send({ error: error.message });
      }
      if (isValidationError(error)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  app.get('/schedules', { preHandler: deps.requireAuth }, async (request) => {
    const schedules = await deps.listSchedules.execute(authOf(request).workspaceId);
    return Promise.all(
      schedules.map(async (schedule) => ({
        id: schedule.id.value,
        workflowId: schedule.workflowId.value,
        workspaceId: schedule.workspaceId.value,
        cronExpression: schedule.cronExpression,
        createdAt: schedule.createdAt,
        nextRunAt: await deps.computeNextRunAt(schedule.id.value),
      })),
    );
  });

  app.delete<{ Params: { id: string } }>(
    '/schedules/:id',
    { preHandler: deps.requireAuth },
    async (request, reply) => {
      try {
        await deps.deleteSchedule.execute(
          authOf(request).workspaceId,
          ScheduleId.create(request.params.id),
        );
        return reply.status(204).send();
      } catch (error) {
        if (error instanceof ScheduleNotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
