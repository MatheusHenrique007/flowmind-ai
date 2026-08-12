import { describe, expect, it } from 'vitest';

import { MockAIProvider } from '../mock-ai-provider.js';

describe('MockAIProvider', () => {
  it('returns a deterministic response clearly marked as a mock', async () => {
    const provider = new MockAIProvider();

    const response = await provider.complete({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(response.content).toMatch(/^\[MOCK\]/);
    expect(response.content).toContain('deterministic');
    expect(response.model).toBe('mock-claude-3-5-sonnet');
    expect(response.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('is deterministic across calls', async () => {
    const provider = new MockAIProvider();

    const first = await provider.complete({ model: 'gpt-4o', messages: [] });
    const second = await provider.complete({ model: 'gpt-4o', messages: [] });

    expect(first).toEqual(second);
  });

  it('never throws for normal input, including empty messages', async () => {
    const provider = new MockAIProvider();

    await expect(
      provider.complete({ model: 'gemini-1.5-pro', messages: [] }),
    ).resolves.toBeDefined();
  });
});
