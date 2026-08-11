import OpenAI from 'openai';
import type { AIProvider, AIRequest, AIResponse } from '@flowmind/ai-contracts';

export interface OpenAIProviderConfig {
  apiKey: string;
  /** Overridable for tests; defaults to the real OpenAI SDK client. */
  client?: OpenAI;
}

/**
 * OpenAI adapter for the AIProvider port. Translates the provider-agnostic
 * AIRequest/AIResponse contract into the OpenAI Chat Completions shape —
 * unlike Claude, OpenAI accepts a "system" role message inline in
 * `messages`, so no splitting is required.
 */
export class OpenAIProvider implements AIProvider {
  private readonly client: OpenAI;

  constructor(config: OpenAIProviderConfig) {
    this.client = config.client ?? new OpenAI({ apiKey: config.apiKey });
  }

  async complete(input: AIRequest): Promise<AIResponse> {
    const response = await this.client.chat.completions.create({
      model: input.model,
      max_tokens: input.maxTokens ?? 1024,
      temperature: input.temperature,
      messages: input.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    const choice = response.choices[0];

    return {
      content: choice?.message?.content ?? '',
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }
}
