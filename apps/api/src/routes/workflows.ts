import {
  WorkflowNotFoundError,
  type CreateWorkflow,
  type UpdateWorkflow,
  type WorkflowInput,
} from '@flowmind/application';
import {
  InvalidStepConfigError,
  InvalidWorkflowDefinitionError,
  WorkflowId,
} from '@flowmind/domain';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { ZodError, z } from 'zod';

import { authOf } from '../auth/require-auth.js';

const stepSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TRIGGER'), kind: z.literal('webhook') }),
  z.object({
    type: z.literal('AI'),
    provider: z.enum(['CLAUDE', 'OPENAI', 'GEMINI']),
    instruction: z.string().min(1),
  }),
  z.object({
    type: z.literal('DESTINATION'),
    destination: z.enum(['SLACK']),
    target: z.string().min(1),
  }),
]);

const workflowInputSchema = z.object({
  name: z.string().min(1),
  steps: z.array(stepSchema).min(1),
});

function isValidationError(error: unknown): error is Error {
  return (
    error instanceof ZodError ||
    error instanceof InvalidWorkflowDefinitionError ||
    error instanceof InvalidStepConfigError
  );
}

/**
 * Presentation only: parses/validates the request shape with Zod and maps
 * validation/not-found errors to the right HTTP status — the use cases
 * themselves know nothing about HTTP.
 *
 * The workspace always comes from the verified access token (`authOf`), never
 * from the request body — the input schema has no workspace field at all, so a
 * client cannot even express "create this in someone else's workspace". A
 * workflow owned by another workspace produces 404, not 403 (ADR-0004).
 */
export async function registerWorkflowRoutes(
  app: FastifyInstance,
  deps: {
    createWorkflow: CreateWorkflow;
    updateWorkflow: UpdateWorkflow;
    requireAuth: preHandlerAsyncHookHandler;
  },
): Promise<void> {
  app.post('/workflows', { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const input = workflowInputSchema.parse(request.body) as WorkflowInput;
      const workflow = await deps.createWorkflow.execute(authOf(request).workspaceId, input);
      return reply.status(201).send({ id: workflow.id.value, name: workflow.name });
    } catch (error) {
      if (isValidationError(error)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  app.put<{ Params: { id: string } }>(
    '/workflows/:id',
    { preHandler: deps.requireAuth },
    async (request, reply) => {
      try {
        const input = workflowInputSchema.parse(request.body) as WorkflowInput;
        const workflow = await deps.updateWorkflow.execute(
          authOf(request).workspaceId,
          WorkflowId.create(request.params.id),
          input,
        );
        return { id: workflow.id.value, name: workflow.name };
      } catch (error) {
        if (error instanceof WorkflowNotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        if (isValidationError(error)) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
