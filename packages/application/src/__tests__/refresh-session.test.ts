import { RefreshTokenSecret } from '@flowmind/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import { InvalidRefreshTokenError } from '../errors/invalid-refresh-token-error.js';
import { LogoutUser } from '../use-cases/logout-user.js';
import { RefreshSession } from '../use-cases/refresh-session.js';
import { RegisterUser } from '../use-cases/register-user.js';

import { FakeClock } from './fakes/fake-clock.js';
import { FakeRefreshTokenRepository } from './fakes/fake-refresh-token-repository.js';
import { FakeTokenService } from './fakes/fake-token-service.js';
import { FakeAccountStore } from './fakes/fake-user-repository.js';

describe('RefreshSession', () => {
  let store: FakeAccountStore;
  let refreshTokens: FakeRefreshTokenRepository;
  let clock: FakeClock;
  let refresh: RefreshSession;
  let initialRefreshToken: string;

  beforeEach(async () => {
    store = new FakeAccountStore();
    refreshTokens = new FakeRefreshTokenRepository();
    clock = new FakeClock();
    const tokenService = new FakeTokenService();

    const session = await new RegisterUser(
      store.userRepository,
      store.workspaceRepository,
      refreshTokens,
      tokenService,
      clock,
    ).execute({ email: 'owner@example.com', password: 'correct horse battery' });
    initialRefreshToken = session.refreshToken;

    refresh = new RefreshSession(refreshTokens, store.userRepository, tokenService, clock);
  });

  it('exchanges a valid refresh token for a new access token and a new refresh token', async () => {
    const rotated = await refresh.execute(initialRefreshToken);

    expect(rotated.refreshToken).not.toBe(initialRefreshToken);
    expect(rotated.accessToken).not.toBe('');
    expect(rotated.user.email).toBe('owner@example.com');
  });

  it('keeps the rotated token in the same family', async () => {
    const rotated = await refresh.execute(initialRefreshToken);

    const oldToken = await refreshTokens.findByTokenHash(
      RefreshTokenSecret.hashOf(initialRefreshToken),
    );
    const newToken = await refreshTokens.findByTokenHash(
      RefreshTokenSecret.hashOf(rotated.refreshToken),
    );
    expect(newToken?.familyId.value).toBe(oldToken?.familyId.value);
  });

  it('invalidates the old refresh token after rotation', async () => {
    await refresh.execute(initialRefreshToken);

    const oldToken = await refreshTokens.findByTokenHash(
      RefreshTokenSecret.hashOf(initialRefreshToken),
    );
    expect(oldToken?.isRevoked()).toBe(true);
    await expect(refresh.execute(initialRefreshToken)).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('revokes the entire family when an already-rotated token is presented again', async () => {
    const rotated = await refresh.execute(initialRefreshToken);
    const secondRotation = await refresh.execute(rotated.refreshToken);

    // Replay of the very first (already rotated) token — theft signal.
    await expect(refresh.execute(initialRefreshToken)).rejects.toThrow(InvalidRefreshTokenError);

    expect(refreshTokens.all().every((token) => token.isRevoked())).toBe(true);
    // ...including the token that was still valid a moment ago.
    await expect(refresh.execute(secondRotation.refreshToken)).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  it('rejects an unknown token', async () => {
    await expect(refresh.execute('never-issued-token')).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('rejects an empty token', async () => {
    await expect(refresh.execute('')).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('rejects an expired token', async () => {
    clock.advanceDays(31);

    await expect(refresh.execute(initialRefreshToken)).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('reports the same error for unknown, expired and revoked tokens', async () => {
    const unknown = await refresh.execute('nope').then(
      () => {
        throw new Error('expected the call to reject');
      },
      (error: unknown) => error as Error,
    );
    await refresh.execute(initialRefreshToken);
    const revoked = await refresh.execute(initialRefreshToken).then(
      () => {
        throw new Error('expected the call to reject');
      },
      (error: unknown) => error as Error,
    );

    expect(unknown.message).toBe(revoked.message);
  });
});

describe('LogoutUser', () => {
  let refreshTokens: FakeRefreshTokenRepository;
  let clock: FakeClock;
  let refresh: RefreshSession;
  let logout: LogoutUser;
  let session: { refreshToken: string };

  beforeEach(async () => {
    const store = new FakeAccountStore();
    refreshTokens = new FakeRefreshTokenRepository();
    clock = new FakeClock();
    const tokenService = new FakeTokenService();
    session = await new RegisterUser(
      store.userRepository,
      store.workspaceRepository,
      refreshTokens,
      tokenService,
      clock,
    ).execute({ email: 'owner@example.com', password: 'correct horse battery' });
    refresh = new RefreshSession(refreshTokens, store.userRepository, tokenService, clock);
    logout = new LogoutUser(refreshTokens, clock);
  });

  it('invalidates the session: the refresh token can no longer be rotated', async () => {
    await logout.execute(session.refreshToken);

    await expect(refresh.execute(session.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('revokes the whole family, so an earlier rotation of the same session is dead too', async () => {
    const rotated = await refresh.execute(session.refreshToken);

    await logout.execute(rotated.refreshToken);

    expect(refreshTokens.all().every((token) => token.isRevoked())).toBe(true);
  });

  it('is idempotent and silent for a missing or unknown token', async () => {
    await expect(logout.execute(undefined)).resolves.toBeUndefined();
    await expect(logout.execute('never-issued')).resolves.toBeUndefined();
    await expect(logout.execute(session.refreshToken)).resolves.toBeUndefined();
    await expect(logout.execute(session.refreshToken)).resolves.toBeUndefined();
  });
});
