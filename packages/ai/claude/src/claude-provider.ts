import type { AIProvider, AIRequest, AIResponse } from '@flowmind/ai-contracts';

/**
 * Anthropic Claude adapter for the AIProvider port. Stub — implementation lands in a later sprint.
 */
export class ClaudeProvider implements AIProvider {
  async complete(_input: AIRequest): Promise<AIResponse> {
    throw new Error('Not implemented');
  }
}
