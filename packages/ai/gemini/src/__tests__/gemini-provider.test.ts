import type { GoogleGenerativeAI } from '@google/generative-ai';
import { describe, expect, it, vi } from 'vitest';

import { GeminiProvider } from '../gemini-provider.js';

function fakeClient(
  generateContentImpl: (params: unknown) => Promise<unknown>,
  captureModelParams?: (params: unknown) => void,
): GoogleGenerativeAI {
  return {
    getGenerativeModel: vi.fn((params: unknown) => {
      captureModelParams?.(params);
      return { generateContent: vi.fn(generateContentImpl) };
    }),
  } as unknown as GoogleGenerativeAI;
}

describe('GeminiProvider', () => {
  it('splits the "system" message into the SDK\'s separate systemInstruction option', async () => {
    let capturedModelParams: Record<string, unknown> = {};
    let capturedContentParams: Record<string, unknown> = {};
    const client = fakeClient(
      async (params) => {
        capturedContentParams = params as Record<string, unknown>;
        return { response: { text: () => 'a summary', usageMetadata: undefined } };
      },
      (params) => {
        capturedModelParams = params as Record<string, unknown>;
      },
    );
    const provider = new GeminiProvider({ apiKey: 'test-key', client });

    await provider.complete({
      model: 'gemini-1.5-pro',
      messages: [
        { role: 'system', content: 'Summarize this.' },
        { role: 'user', content: 'raw ticket text' },
      ],
    });

    expect(capturedModelParams.systemInstruction).toBe('Summarize this.');
    expect(capturedContentParams.contents).toEqual([
      { role: 'user', parts: [{ text: 'raw ticket text' }] },
    ]);
  });

  it('normalizes the SDK response into the provider-agnostic AIResponse shape', async () => {
    const client = fakeClient(async () => ({
      response: {
        text: () => 'a short summary',
        usageMetadata: {
          promptTokenCount: 20,
          candidatesTokenCount: 8,
          totalTokenCount: 28,
        },
      },
    }));
    const provider = new GeminiProvider({ apiKey: 'test-key', client });

    const response = await provider.complete({
      model: 'gemini-1.5-pro',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(response).toEqual({
      content: 'a short summary',
      model: 'gemini-1.5-pro',
      usage: { promptTokens: 20, completionTokens: 8, totalTokens: 28 },
    });
  });

  it('maps the "assistant" role to Gemini\'s "model" role', async () => {
    let capturedContentParams: Record<string, unknown> = {};
    const client = fakeClient(async (params) => {
      capturedContentParams = params as Record<string, unknown>;
      return { response: { text: () => 'ok', usageMetadata: undefined } };
    });
    const provider = new GeminiProvider({ apiKey: 'test-key', client });

    await provider.complete({
      model: 'gemini-1.5-pro',
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ],
    });

    expect(capturedContentParams.contents).toEqual([
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: 'hello' }] },
    ]);
  });

  it('propagates errors thrown by the underlying SDK call', async () => {
    const client = fakeClient(async () => {
      throw new Error('Gemini API quota exceeded');
    });
    const provider = new GeminiProvider({ apiKey: 'test-key', client });

    await expect(
      provider.complete({ model: 'gemini-1.5-pro', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow('Gemini API quota exceeded');
  });
});
