import { describe, expect, it } from 'vitest';

import { JoseTokenService } from '../auth/jose-token-service.js';

const SECRET = 'a'.repeat(32);

/**
 * Pure unit test — no database, so this runs unconditionally (unlike the
 * Prisma suites, which skip without DATABASE_URL).
 */
describe('JoseTokenService', () => {
  const service = new JoseTokenService({ secret: SECRET });

  it('round-trips the userId and workspaceId claims', async () => {
    const token = await service.signAccessToken({ userId: 'user-1', workspaceId: 'workspace-1' });

    await expect(service.verifyAccessToken(token)).resolves.toEqual({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await new JoseTokenService({ secret: 'b'.repeat(32) }).signAccessToken({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    await expect(service.verifyAccessToken(token)).resolves.toBeNull();
  });

  it('rejects a tampered token', async () => {
    const token = await service.signAccessToken({ userId: 'user-1', workspaceId: 'workspace-1' });
    const [header, payload, signature] = token.split('.');
    const forged = [
      header,
      Buffer.from('{"sub":"attacker","workspaceId":"workspace-2"}').toString('base64url'),
      signature,
    ].join('.');

    await expect(service.verifyAccessToken(forged)).resolves.toBeNull();
  });

  it('returns null — never throws — for garbage input', async () => {
    await expect(service.verifyAccessToken('')).resolves.toBeNull();
    await expect(service.verifyAccessToken('not-a-jwt')).resolves.toBeNull();
    await expect(service.verifyAccessToken('a.b.c')).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    const expiring = new JoseTokenService({ secret: SECRET, ttl: '0s' });
    const token = await expiring.signAccessToken({ userId: 'user-1', workspaceId: 'workspace-1' });

    await expect(expiring.verifyAccessToken(token)).resolves.toBeNull();
  });

  it('refuses to be constructed with a too-short secret', () => {
    expect(() => new JoseTokenService({ secret: 'too-short' })).toThrow(/at least 32 characters/);
  });
});
