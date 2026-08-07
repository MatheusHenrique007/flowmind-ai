import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIRequest, AIResponse } from '@flowmind/ai-contracts';

export interface ClaudeProviderConfig {
  apiKey: string;
  /** Overridable for tests; defaults to the real Anthropic SDK client. */
  client?: Anthropic;
}

/**
 * Anthropic Claude adapter for the AIProvider port. Translates the
 * provider-agnostic AIRequest/AIResponse contract into the Anthropic SDK's
 * shape — the "system" role message becomes the SDK's separate `system`
 * parameter, since Anthropic doesn't accept it inside `messages`.
 */
export class ClaudeProvider implements AIProvider {
  private readonly client: Anthropic;

  constructor(config: ClaudeProviderConfig) {
    this.client = config.client ?? new Anthropic({ apiKey: config.apiKey });
  }

  async complete(input: AIRequest): Promise<AIResponse> {
    const systemMessages = input.messages.filter((message) => message.role === 'system');
    const conversationMessages = input.messages.filter((message) => message.role !== 'system');

    const response = await this.client.messages.create({
      model: input.model,
      max_tokens: input.maxTokens ?? 1024,
      temperature: input.temperature,
      system: systemMessages.map((message) => message.content).join('\n\n') || undefined,
      messages: conversationMessages.map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      })),
    });

    const textBlock = response.content.find((block) => block.type === 'text');

    return {
      content: textBlock?.type === 'text' ? textBlock.text : '',
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          }
        : undefined,
    };
  }
}
