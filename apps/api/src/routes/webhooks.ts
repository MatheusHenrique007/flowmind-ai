import type { WorkflowQueue } from '@flowmind/application';
import { WorkflowId } from '@flowmind/domain';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { authOf } from '../auth/require-auth.js';

/**
 * Presentation only: validates the path param shape and enqueues the job.
 * Never calls ExecuteWorkflow or the Engine directly — execution happens
 * asynchronously in the Worker.
 *
 * The workspace enqueued with the job comes from the access token, so the
 * Worker executes strictly within the caller's tenant. A request naming another
 * workspace's workflow id still gets the same 202 (this endpoint cannot report
 * a result it does not wait for), and the execution then fails as "not found"
 * inside ExecuteWorkflow — no run row is created, and the 202/404 shape reveals
 * nothing about whether that id exists elsewhere.
 */
export async function registerWebhookRoutes(
  app: FastifyInstance,
  deps: { workflowQueue: WorkflowQueue; requireAuth: preHandlerAsyncHookHandler },
): Promise<void> {
  app.post<{ Params: { workflowId: string }; Body: unknown }>(
    '/webhooks/:workflowId',
    { preHandler: deps.requireAuth },
    async (request, reply) => {
      const workflowId = WorkflowId.create(request.params.workflowId);
      await deps.workflowQueue.enqueue(authOf(request).workspaceId, workflowId, request.body);
      return reply.status(202).send({ accepted: true });
    },
  );
}
