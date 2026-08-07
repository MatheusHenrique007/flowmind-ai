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
import type { FastifyInstance } from 'fastify';
import { ZodError, z } from 'zod';

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
 */
export async function registerWorkflowRoutes(
  app: FastifyInstance,
  deps: { createWorkflow: CreateWorkflow; updateWorkflow: UpdateWorkflow },
): Promise<void> {
  app.post('/workflows', async (request, reply) => {
    try {
      const input = workflowInputSchema.parse(request.body) as WorkflowInput;
      const workflow = await deps.createWorkflow.execute(input);
      return reply.status(201).send({ id: workflow.id.value, name: workflow.name });
    } catch (error) {
      if (isValidationError(error)) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  app.put<{ Params: { id: string } }>('/workflows/:id', async (request, reply) => {
    try {
      const input = workflowInputSchema.parse(request.body) as WorkflowInput;
      const workflow = await deps.updateWorkflow.execute(
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
  });
}
