import type { AIProvider, AIRequest, AIResponse } from '@flowmind/ai-contracts';

export class FakeAIProvider implements AIProvider {
  private response: AIResponse | undefined;
  private error: Error | undefined;
  public lastRequest: AIRequest | undefined;

  willReturn(response: AIResponse): void {
    this.response = response;
    this.error = undefined;
  }

  willThrow(error: Error): void {
    this.error = error;
    this.response = undefined;
  }

  async complete(input: AIRequest): Promise<AIResponse> {
    this.lastRequest = input;
    if (this.error) {
      throw this.error;
    }
    if (!this.response) {
      throw new Error('FakeAIProvider.complete called before willReturn/willThrow was set.');
    }
    return this.response;
  }
}
