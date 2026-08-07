import {
  WorkflowNotFoundError,
  WorkflowRunNotFoundError,
  type GetWorkflowRun,
  type ListWorkflowRuns,
} from '@flowmind/application';
import { WorkflowRunId } from '@flowmind/domain';
import type { FastifyInstance } from 'fastify';

/**
 * Presentation only: maps application-level not-found errors to HTTP 404 —
 * neither GetWorkflowRun nor ListWorkflowRuns knows about HTTP.
 */
export async function registerWorkflowRunRoutes(
  app: FastifyInstance,
  deps: { getWorkflowRun: GetWorkflowRun; listWorkflowRuns: ListWorkflowRuns },
): Promise<void> {
  app.get('/workflow-runs', async () => deps.listWorkflowRuns.execute());

  app.get<{ Params: { id: string } }>('/workflow-runs/:id', async (request, reply) => {
    try {
      const view = await deps.getWorkflowRun.execute(WorkflowRunId.create(request.params.id));
      return view;
    } catch (error) {
      if (error instanceof WorkflowRunNotFoundError || error instanceof WorkflowNotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      throw error;
    }
  });
}
