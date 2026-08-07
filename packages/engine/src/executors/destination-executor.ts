import type { AIResponse } from '@flowmind/ai-contracts';
import type { Destination } from '@flowmind/destinations-contracts';
import {
  StepType,
  type DestinationKind,
  type ExecutionContext,
  type WorkflowStep,
} from '@flowmind/domain';

import { StepExecutionError } from '../errors/step-execution-error.js';
import type { StepExecutionOutcome, StepExecutor } from '../step-executor.js';

export type DestinationResolver = (destination: DestinationKind) => Destination | undefined;

function isAIResponse(value: unknown): value is AIResponse {
  return typeof value === 'object' && value !== null && 'content' in value;
}

/**
 * Resolves a concrete Destination through an injected resolver — never
 * through a vendor SDK directly. Mirrors AIExecutor's resolver pattern.
 */
export class DestinationExecutor implements StepExecutor {
  constructor(private readonly resolveDestination: DestinationResolver) {}

  async execute(step: WorkflowStep, context: ExecutionContext): Promise<StepExecutionOutcome> {
    if (step.config.type !== StepType.DESTINATION) {
      throw new StepExecutionError(
        step.id,
        'DestinationExecutor received a step that is not a Destination step.',
      );
    }
    const { config } = step;

    const destination = this.resolveDestination(config.destination);
    if (!destination) {
      throw new StepExecutionError(
        step.id,
        `No Destination registered for destination "${config.destination}".`,
      );
    }

    const aiOutput = context.get('aiOutput');
    const content = isAIResponse(aiOutput) ? aiOutput.content : String(context.get('input'));

    try {
      const result = await destination.send({ target: config.target, content });
      return { context: context.with('destinationResult', result), output: result };
    } catch (cause) {
      throw new StepExecutionError(
        step.id,
        `Destination "${config.destination}" failed to deliver the message.`,
        cause,
      );
    }
  }
}
