import { describe, expect, it } from 'vitest';

import { RefreshToken } from '../entities/refresh-token.js';
import { TokenFamilyId } from '../value-objects/token-family-id.js';
import { UserId } from '../value-objects/user-id.js';

const NOW = new Date('2026-08-10T12:00:00Z');

function newToken(overrides: { expiresAt?: Date; revokedAt?: Date } = {}): RefreshToken {
  return RefreshToken.create({
    userId: UserId.generate(),
    tokenHash: 'a'.repeat(64),
    familyId: TokenFamilyId.generate(),
    expiresAt: overrides.expiresAt ?? new Date('2026-08-17T12:00:00Z'),
    createdAt: NOW,
    revokedAt: overrides.revokedAt,
  });
}

describe('RefreshToken', () => {
  it('is active when neither expired nor revoked', () => {
    const token = newToken();

    expect(token.isRevoked()).toBe(false);
    expect(token.isExpired(NOW)).toBe(false);
    expect(token.isActive(NOW)).toBe(true);
  });

  it('is expired once now has reached expiresAt', () => {
    const token = newToken({ expiresAt: NOW });

    expect(token.isExpired(NOW)).toBe(true);
    expect(token.isActive(NOW)).toBe(false);
  });

  it('becomes revoked and inactive after revoke()', () => {
    const token = newToken();
    token.revoke(NOW);

    expect(token.isRevoked()).toBe(true);
    expect(token.revokedAt).toEqual(NOW);
    expect(token.isActive(NOW)).toBe(false);
  });

  it('keeps the first revocation timestamp when revoked twice', () => {
    const token = newToken();
    token.revoke(NOW);
    token.revoke(new Date('2026-08-11T12:00:00Z'));

    expect(token.revokedAt).toEqual(NOW);
  });
});
