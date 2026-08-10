import { RefreshTokenId } from '../value-objects/refresh-token-id.js';
import type { TokenFamilyId } from '../value-objects/token-family-id.js';
import type { UserId } from '../value-objects/user-id.js';

/**
 * A single, rotatable refresh token. Stores only the SHA-256 hash of the
 * opaque random value handed to the client — the raw token exists nowhere in
 * the domain or the database (see docs/adr/0003-authentication-token-strategy.md).
 *
 * `familyId` links every token produced by successive rotations of one login
 * session, so presenting an already-revoked token (a theft/replay signal) can
 * revoke that whole chain rather than just the one token.
 */
export class RefreshToken {
  readonly id: RefreshTokenId;
  readonly userId: UserId;
  readonly tokenHash: string;
  readonly familyId: TokenFamilyId;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  private _revokedAt?: Date;

  private constructor(params: {
    id: RefreshTokenId;
    userId: UserId;
    tokenHash: string;
    familyId: TokenFamilyId;
    expiresAt: Date;
    createdAt: Date;
    revokedAt?: Date;
  }) {
    this.id = params.id;
    this.userId = params.userId;
    this.tokenHash = params.tokenHash;
    this.familyId = params.familyId;
    this.expiresAt = params.expiresAt;
    this.createdAt = params.createdAt;
    this._revokedAt = params.revokedAt;
  }

  static create(params: {
    id?: RefreshTokenId;
    userId: UserId;
    tokenHash: string;
    familyId: TokenFamilyId;
    expiresAt: Date;
    createdAt?: Date;
    revokedAt?: Date;
  }): RefreshToken {
    return new RefreshToken({
      id: params.id ?? RefreshTokenId.generate(),
      userId: params.userId,
      tokenHash: params.tokenHash,
      familyId: params.familyId,
      expiresAt: params.expiresAt,
      createdAt: params.createdAt ?? new Date(),
      revokedAt: params.revokedAt,
    });
  }

  get revokedAt(): Date | undefined {
    return this._revokedAt;
  }

  isExpired(now: Date): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  isRevoked(): boolean {
    return this._revokedAt !== undefined;
  }

  /** Idempotent: revoking an already-revoked token keeps the original timestamp. */
  revoke(now: Date = new Date()): void {
    this._revokedAt ??= now;
  }

  /** True only when the token can still be exchanged for a new session. */
  isActive(now: Date): boolean {
    return !this.isRevoked() && !this.isExpired(now);
  }
}
