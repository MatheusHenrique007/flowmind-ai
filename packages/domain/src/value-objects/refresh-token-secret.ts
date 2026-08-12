import { createHash, randomBytes } from 'node:crypto';

/**
 * The opaque refresh token value handed to the client, plus the SHA-256 hash
 * that is the only form ever persisted.
 *
 * SHA-256 (not scrypt) is deliberate: the value is 256 bits of CSPRNG output,
 * so it is already brute-force-infeasible and a slow KDF would only cost CPU
 * on every refresh — see docs/adr/0003-authentication-token-strategy.md.
 *
 * `node:crypto` in Domain follows the precedent already set by EntityId
 * (`randomUUID`) and PasswordHash (`scrypt`).
 */
export class RefreshTokenSecret {
  /** The raw value — goes into the httpOnly cookie and nowhere else. */
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static generate(): RefreshTokenSecret {
    return new RefreshTokenSecret(randomBytes(32).toString('base64url'));
  }

  static hashOf(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  get hash(): string {
    return RefreshTokenSecret.hashOf(this.value);
  }

  toString(): string {
    return this.value;
  }
}
