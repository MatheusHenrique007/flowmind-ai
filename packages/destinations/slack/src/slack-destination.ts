import type {
  Destination,
  DestinationPayload,
  DestinationResult,
} from '@flowmind/destinations-contracts';

export interface SlackDestinationConfig {
  /** Bot token with chat:write scope. */
  botToken: string;
  /** Overridable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Slack adapter for the Destination port, using the Slack Web API's
 * chat.postMessage directly over fetch — no @slack/web-api dependency, since
 * a single authenticated POST is all this release needs.
 */
export class SlackDestination implements Destination {
  private readonly botToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SlackDestinationConfig) {
    this.botToken = config.botToken;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async send(payload: DestinationPayload): Promise<DestinationResult> {
    const response = await this.fetchImpl('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ channel: payload.target, text: payload.content }),
    });

    const body = (await response.json()) as { ok: boolean; error?: string };

    if (!body.ok) {
      return { delivered: false, details: body.error ?? 'Unknown Slack API error.' };
    }

    return { delivered: true };
  }
}
