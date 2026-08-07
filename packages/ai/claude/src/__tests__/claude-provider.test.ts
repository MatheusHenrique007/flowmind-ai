import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { ClaudeProvider } from '../claude-provider.js';

function fakeClient(createImpl: (params: unknown) => Promise<unknown>): Anthropic {
  return { messages: { create: vi.fn(createImpl) } } as unknown as Anthropic;
}

describe('ClaudeProvider', () => {
  it('splits the "system" message into the SDK\'s separate system parameter', async () => {
    let capturedParams: Record<string, unknown> = {};
    const client = fakeClient(async (params) => {
      capturedParams = params as Record<string, unknown>;
      return {
        content: [{ type: 'text', text: 'a summary' }],
        model: 'claude-3-5-sonnet',
        usage: { input_tokens: 10, output_tokens: 5 },
      };
    });
    const provider = new ClaudeProvider({ apiKey: 'test-key', client });

    await provider.complete({
      model: 'claude-3-5-sonnet',
      messages: [
        { role: 'system', content: 'Summarize this.' },
        { role: 'user', content: 'raw ticket text' },
      ],
    });

    expect(capturedParams.system).toBe('Summarize this.');
    expect(capturedParams.messages).toEqual([{ role: 'user', content: 'raw ticket text' }]);
  });

  it('normalizes the SDK response into the provider-agnostic AIResponse shape', async () => {
    const client = fakeClient(async () => ({
      content: [{ type: 'text', text: 'a short summary' }],
      model: 'claude-3-5-sonnet',
      usage: { input_tokens: 20, output_tokens: 8 },
    }));
    const provider = new ClaudeProvider({ apiKey: 'test-key', client });

    const response = await provider.complete({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(response).toEqual({
      content: 'a short summary',
      model: 'claude-3-5-sonnet',
      usage: { promptTokens: 20, completionTokens: 8, totalTokens: 28 },
    });
  });

  it('returns an empty content string when the response has no text block', async () => {
    const client = fakeClient(async () => ({
      content: [{ type: 'tool_use' }],
      model: 'claude-3-5-sonnet',
    }));
    const provider = new ClaudeProvider({ apiKey: 'test-key', client });

    const response = await provider.complete({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(response.content).toBe('');
    expect(response.usage).toBeUndefined();
  });
});
