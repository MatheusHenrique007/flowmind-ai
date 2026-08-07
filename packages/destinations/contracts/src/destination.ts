import type { DestinationPayload } from './destination-payload.js';
import type { DestinationResult } from './destination-result.js';

/**
 * Port implemented by every destination adapter (Slack, Discord, Email, ...).
 *
 * Application/Engine code depends only on this interface, never on a vendor
 * SDK directly — mirrors AIProvider (@flowmind/ai-contracts), see ADR-0002.
 */
export interface Destination {
  send(payload: DestinationPayload): Promise<DestinationResult>;
}
