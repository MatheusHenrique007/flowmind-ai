import { describe, expect, it, vi } from 'vitest';

import { SlackDestination } from '../slack-destination.js';

function fakeFetch(responseBody: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    json: async () => responseBody,
  }) as unknown as typeof fetch;
}

describe('SlackDestination', () => {
  it('posts the channel and content to chat.postMessage with a Bearer token', async () => {
    const fetchImpl = fakeFetch({ ok: true });
    const destination = new SlackDestination({ botToken: 'xoxb-test', fetchImpl });

    const result = await destination.send({ target: '#alerts', content: 'a short summary' });

    expect(result).toEqual({ delivered: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer xoxb-test' }),
        body: JSON.stringify({ channel: '#alerts', text: 'a short summary' }),
      }),
    );
  });

  it('reports delivered: false with the Slack error when the API responds ok: false', async () => {
    const fetchImpl = fakeFetch({ ok: false, error: 'channel_not_found' });
    const destination = new SlackDestination({ botToken: 'xoxb-test', fetchImpl });

    const result = await destination.send({ target: '#missing', content: 'hi' });

    expect(result).toEqual({ delivered: false, details: 'channel_not_found' });
  });
});
