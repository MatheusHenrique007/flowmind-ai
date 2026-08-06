import type { AIProvider } from '@flowmind/ai-contracts';

/**
 * Supported AI provider identifiers. Extend as new adapters are added.
 */
export type AIProviderName = 'openai' | 'claude' | 'gemini';

/**
 * Resolves an AIProvider implementation by name.
 *
 * Placeholder for Sprint 0 — wiring to concrete adapters
 * (@flowmind/ai-openai, @flowmind/ai-claude, @flowmind/ai-gemini) lands
 * in a later sprint once those adapters are implemented.
 */
export function createAIProvider(_name: AIProviderName): AIProvider {
  throw new Error('Not implemented');
}
