/**
 * The role of a single message in a conversation sent to an AI provider.
 */
export type AIRole = 'system' | 'user' | 'assistant';

/**
 * A single message in a conversation, provider-agnostic.
 */
export interface AIMessage {
  role: AIRole;
  content: string;
}

/**
 * Input to an AIProvider#complete call. Kept intentionally provider-agnostic:
 * adapters are responsible for translating this into the shape their SDK expects.
 */
export interface AIRequest {
  /** Logical model identifier (e.g. "gpt-4o", "claude-3-5-sonnet"). Resolved by the adapter/factory. */
  model: string;
  messages: AIMessage[];
  /** Sampling temperature, 0-2. Optional — adapters apply their own default when omitted. */
  temperature?: number;
  /** Maximum tokens to generate. Optional — adapters apply their own default when omitted. */
  maxTokens?: number;
}
