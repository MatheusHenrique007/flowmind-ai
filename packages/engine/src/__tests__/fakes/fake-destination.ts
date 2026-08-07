import type {
  Destination,
  DestinationPayload,
  DestinationResult,
} from '@flowmind/destinations-contracts';

export class FakeDestination implements Destination {
  private result: DestinationResult | undefined;
  private error: Error | undefined;
  public lastPayload: DestinationPayload | undefined;

  willReturn(result: DestinationResult): void {
    this.result = result;
    this.error = undefined;
  }

  willThrow(error: Error): void {
    this.error = error;
    this.result = undefined;
  }

  async send(payload: DestinationPayload): Promise<DestinationResult> {
    this.lastPayload = payload;
    if (this.error) {
      throw this.error;
    }
    if (!this.result) {
      throw new Error('FakeDestination.send called before willReturn/willThrow was set.');
    }
    return this.result;
  }
}
