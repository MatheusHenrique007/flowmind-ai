import type { WorkflowQueue } from '@flowmind/application';
import { WorkflowId } from '@flowmind/domain';
import type { FastifyInstance } from 'fastify';

/**
 * Presentation only: validates the path param shape and enqueues the job.
 * Never calls ExecuteWorkflow or the Engine directly — execution happens
 * asynchronously in the Worker.
 */
export async function registerWebhookRoutes(
  app: FastifyInstance,
  deps: { workflowQueue: WorkflowQueue },
): Promise<void> {
  app.post<{ Params: { workflowId: string }; Body: unknown }>(
    '/webhooks/:workflowId',
    async (request, reply) => {
      const workflowId = WorkflowId.create(request.params.workflowId);
      await deps.workflowQueue.enqueue(workflowId, request.body);
      return reply.status(202).send({ accepted: true });
    },
  );
}
