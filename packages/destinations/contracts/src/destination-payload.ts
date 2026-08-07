/**
 * Input to a Destination#send call. Kept intentionally generic — adapters
 * are responsible for translating this into the shape their target expects
 * (a Slack message, a Discord embed, an email body, ...).
 */
export interface DestinationPayload {
  /** Where to deliver the content — adapter-specific (e.g. a Slack channel). */
  target: string;
  content: string;
}
