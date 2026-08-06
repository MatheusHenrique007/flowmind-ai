import type { AIRequest } from './ai-request.js';
import type { AIResponse } from './ai-response.js';

/**
 * Port implemented by every AI provider adapter (OpenAI, Claude, Gemini, ...).
 *
 * Application code depends only on this interface, never on a provider SDK
 * directly — see docs/adr/0001-foundation-decisions.md (Decision 3) for rationale.
 */
export interface AIProvider {
  /**
   * Sends a completion request to the underlying provider and returns a
   * normalized response.
   */
  complete(input: AIRequest): Promise<AIResponse>;
}
