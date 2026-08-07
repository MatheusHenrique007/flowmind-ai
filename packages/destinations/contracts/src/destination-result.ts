/**
 * Output of a Destination#send call. Provider-agnostic: adapters normalize
 * their target's response shape into this contract.
 */
export interface DestinationResult {
  delivered: boolean;
  details?: string;
}
