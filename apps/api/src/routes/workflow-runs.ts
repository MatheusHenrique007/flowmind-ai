import {
  WorkflowNotFoundError,
  WorkflowRunNotFoundError,
  type GetWorkflowRun,
  type ListWorkflowRuns,
} from '@flowmind/application';
import { WorkflowRunId } from '@flowmind/domain';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { authOf } from '../auth/require-auth.js';

/**
 * Presentation only: maps application-level not-found errors to HTTP 404 —
 * neither GetWorkflowRun nor ListWorkflowRuns knows about HTTP. Both are
 * scoped to the authenticated session's workspace, so another tenant's run is
 * a 404 and the list can only ever contain the caller's own runs.
 */
export async function registerWorkflowRunRoutes(
  app: FastifyInstance,
  deps: {
    getWorkflowRun: GetWorkflowRun;
    listWorkflowRuns: ListWorkflowRuns;
    requireAuth: preHandlerAsyncHookHandler;
  },
): Promise<void> {
  app.get('/workflow-runs', { preHandler: deps.requireAuth }, async (request) =>
    deps.listWorkflowRuns.execute(authOf(request).workspaceId),
  );

  app.get<{ Params: { id: string } }>(
    '/workflow-runs/:id',
    { preHandler: deps.requireAuth },
    async (request, reply) => {
      try {
        const view = await deps.getWorkflowRun.execute(
          authOf(request).workspaceId,
          WorkflowRunId.create(request.params.id),
        );
        return view;
      } catch (error) {
        if (error instanceof WorkflowRunNotFoundError || error instanceof WorkflowNotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
