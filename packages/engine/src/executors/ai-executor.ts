import type { AIProvider } from '@flowmind/ai-contracts';
import {
  StepType,
  type ExecutionContext,
  type Provider,
  type WorkflowStep,
} from '@flowmind/domain';

import { StepExecutionError } from '../errors/step-execution-error.js';
import type { StepExecutionOutcome, StepExecutor } from '../step-executor.js';

/**
 * Default model per provider. This is a request-shape label, not a vendor
 * SDK call — the concrete adapter behind the resolved AIProvider decides how
 * (or whether) to honor it. Living here, not in a vendor SDK import, keeps
 * this package free of infrastructure dependencies.
 */
const DEFAULT_MODEL_BY_PROVIDER: Record<Provider, string> = {
  CLAUDE: 'claude-3-5-sonnet',
  OPENAI: 'gpt-4o',
  GEMINI: 'gemini-1.5-pro',
};

export type AIProviderResolver = (provider: Provider) => AIProvider | undefined;

/**
 * Resolves a concrete AIProvider through an injected resolver — never
 * through @flowmind/ai-factory or a vendor SDK directly. The composition
 * root (Infrastructure) is what supplies a real resolver; tests supply a
 * fake one.
 */
export class AIExecutor implements StepExecutor {
  constructor(private readonly resolveProvider: AIProviderResolver) {}

  async execute(step: WorkflowStep, context: ExecutionContext): Promise<StepExecutionOutcome> {
    if (step.config.type !== StepType.AI) {
      throw new StepExecutionError(step.id, 'AIExecutor received a step that is not an AI step.');
    }
    const { config } = step;

    const provider = this.resolveProvider(config.provider);
    if (!provider) {
      throw new StepExecutionError(
        step.id,
        `No AIProvider registered for provider "${config.provider}".`,
      );
    }

    try {
      const response = await provider.complete({
        model: DEFAULT_MODEL_BY_PROVIDER[config.provider],
        messages: [
          { role: 'system', content: config.instruction },
          { role: 'user', content: String(context.get('input')) },
        ],
      });

      return { context: context.with('aiOutput', response), output: response };
    } catch (cause) {
      throw new StepExecutionError(
        step.id,
        `AIProvider "${config.provider}" failed to complete the request.`,
        cause,
      );
    }
  }
}
