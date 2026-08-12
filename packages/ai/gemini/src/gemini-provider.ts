import type { AIProvider, AIRequest, AIResponse } from '@flowmind/ai-contracts';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiProviderConfig {
  apiKey: string;
  /** Overridable for tests; defaults to the real Google Generative AI SDK client. */
  client?: GoogleGenerativeAI;
}

/**
 * Google Gemini adapter for the AIProvider port. Translates the
 * provider-agnostic AIRequest/AIResponse contract into the Generative AI
 * SDK's shape — the "system" role message becomes the SDK's separate
 * `systemInstruction` model option, and the SDK's "assistant" role is named
 * "model" instead, since Gemini doesn't accept "system"/"assistant" inside
 * `contents`.
 */
export class GeminiProvider implements AIProvider {
  private readonly client: GoogleGenerativeAI;

  constructor(config: GeminiProviderConfig) {
    this.client = config.client ?? new GoogleGenerativeAI(config.apiKey);
  }

  async complete(input: AIRequest): Promise<AIResponse> {
    const systemMessages = input.messages.filter((message) => message.role === 'system');
    const conversationMessages = input.messages.filter((message) => message.role !== 'system');

    const model = this.client.getGenerativeModel({
      model: input.model,
      systemInstruction: systemMessages.map((message) => message.content).join('\n\n') || undefined,
    });

    const result = await model.generateContent({
      contents: conversationMessages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        temperature: input.temperature,
        maxOutputTokens: input.maxTokens ?? 1024,
      },
    });

    const usage = result.response.usageMetadata;

    return {
      content: result.response.text(),
      model: input.model,
      usage: usage
        ? {
            promptTokens: usage.promptTokenCount,
            completionTokens: usage.candidatesTokenCount,
            totalTokens: usage.totalTokenCount,
          }
        : undefined,
    };
  }
}
