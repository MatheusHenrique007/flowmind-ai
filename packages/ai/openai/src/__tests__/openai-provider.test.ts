import type OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';

import { OpenAIProvider } from '../openai-provider.js';

function fakeClient(createImpl: (params: unknown) => Promise<unknown>): OpenAI {
  return {
    chat: { completions: { create: vi.fn(createImpl) } },
  } as unknown as OpenAI;
}

describe('OpenAIProvider', () => {
  it('sends the messages (including "system") straight through to the Chat Completions API', async () => {
    let capturedParams: Record<string, unknown> = {};
    const client = fakeClient(async (params) => {
      capturedParams = params as Record<string, unknown>;
      return {
        choices: [{ message: { content: 'a summary' } }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
    });
    const provider = new OpenAIProvider({ apiKey: 'test-key', client });

    await provider.complete({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Summarize this.' },
        { role: 'user', content: 'raw ticket text' },
      ],
    });

    expect(capturedParams.messages).toEqual([
      { role: 'system', content: 'Summarize this.' },
      { role: 'user', content: 'raw ticket text' },
    ]);
    expect(capturedParams.model).toBe('gpt-4o');
  });

  it('normalizes the SDK response into the provider-agnostic AIResponse shape', async () => {
    const client = fakeClient(async () => ({
      choices: [{ message: { content: 'a short summary' } }],
      model: 'gpt-4o',
      usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
    }));
    const provider = new OpenAIProvider({ apiKey: 'test-key', client });

    const response = await provider.complete({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(response).toEqual({
      content: 'a short summary',
      model: 'gpt-4o',
      usage: { promptTokens: 20, completionTokens: 8, totalTokens: 28 },
    });
  });

  it('returns an empty content string when the response has no choice content', async () => {
    const client = fakeClient(async () => ({
      choices: [{ message: {} }],
      model: 'gpt-4o',
    }));
    const provider = new OpenAIProvider({ apiKey: 'test-key', client });

    const response = await provider.complete({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(response.content).toBe('');
    expect(response.usage).toBeUndefined();
  });

  it('propagates errors thrown by the underlying SDK call', async () => {
    const client = fakeClient(async () => {
      throw new Error('OpenAI API rate limited');
    });
    const provider = new OpenAIProvider({ apiKey: 'test-key', client });

    await expect(
      provider.complete({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow('OpenAI API rate limited');
  });
});
