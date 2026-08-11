import type { AIProvider, AIRequest, AIResponse } from '@flowmind/ai-contracts';

/**
 * Deterministic stand-in for a real AIProvider. Used ONLY by the composition
 * root, as a static substitution decided once at process boot when a real
 * provider's API key is absent — never as a runtime fallback-on-failure
 * mechanism, and never selectable from a workflow's AIStepConfig (MOCK is
 * not a Domain Provider value; see docs/adr/0005).
 *
 * Its response content is deliberately, unmistakably marked as synthetic so
 * it can never be confused with a real Claude/OpenAI/Gemini reply — the demo
 * must stay honest about what it's showing.
 */
export class MockAIProvider implements AIProvider {
  async complete(input: AIRequest): Promise<AIResponse> {
    return {
      content:
        '[MOCK] This is a deterministic FlowMind demo response. ' +
        'No real AI provider API key was configured, so this step ran against ' +
        'the mock provider instead of a live model.',
      model: `mock-${input.model}`,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }
}
