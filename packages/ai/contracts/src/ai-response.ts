/**
 * Token usage reported by the provider for a single completion, when available.
 */
export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Output of an AIProvider#complete call. Provider-agnostic: adapters normalize
 * their SDK's response shape into this contract.
 */
export interface AIResponse {
  content: string;
  model: string;
  usage?: AIUsage;
}
