import { beforeEach, describe, expect, it } from 'vitest';

import { InvalidCredentialsError } from '../errors/invalid-credentials-error.js';
import { LoginUser } from '../use-cases/login-user.js';
import { RegisterUser } from '../use-cases/register-user.js';

import { FakeClock } from './fakes/fake-clock.js';
import { FakeRefreshTokenRepository } from './fakes/fake-refresh-token-repository.js';
import { FakeTokenService } from './fakes/fake-token-service.js';
import { FakeAccountStore } from './fakes/fake-user-repository.js';

const PASSWORD = 'correct horse battery';

describe('LoginUser', () => {
  let store: FakeAccountStore;
  let refreshTokens: FakeRefreshTokenRepository;
  let tokenService: FakeTokenService;
  let login: LoginUser;

  beforeEach(async () => {
    store = new FakeAccountStore();
    refreshTokens = new FakeRefreshTokenRepository();
    tokenService = new FakeTokenService();
    const clock = new FakeClock();
    await new RegisterUser(
      store.userRepository,
      store.workspaceRepository,
      refreshTokens,
      tokenService,
      clock,
    ).execute({ email: 'owner@example.com', password: PASSWORD });
    login = new LoginUser(store.userRepository, refreshTokens, tokenService, clock);
  });

  it('issues a session for the right password', async () => {
    const session = await login.execute({ email: 'owner@example.com', password: PASSWORD });

    expect(session.user.email).toBe('owner@example.com');
    expect(session.accessToken).not.toBe('');
    expect(session.refreshToken).not.toBe('');
  });

  it('accepts a differently-cased spelling of the same email', async () => {
    await expect(
      login.execute({ email: 'OWNER@example.com', password: PASSWORD }),
    ).resolves.toBeDefined();
  });

  it('rejects a wrong password', async () => {
    await expect(
      login.execute({ email: 'owner@example.com', password: 'wrong password' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('reports the exact same error for an unknown email as for a wrong password (no enumeration)', async () => {
    const unknownEmail = await login
      .execute({ email: 'nobody@example.com', password: PASSWORD })
      .then(
        () => {
          throw new Error('expected the call to reject');
        },
        (error: unknown) => error as Error,
      );
    const wrongPassword = await login
      .execute({ email: 'owner@example.com', password: 'wrong password' })
      .then(
        () => {
          throw new Error('expected the call to reject');
        },
        (error: unknown) => error as Error,
      );
    const malformedEmail = await login.execute({ email: 'not-an-email', password: PASSWORD }).then(
      () => {
        throw new Error('expected the call to reject');
      },
      (error: unknown) => error as Error,
    );

    expect(unknownEmail).toBeInstanceOf(InvalidCredentialsError);
    expect(wrongPassword).toBeInstanceOf(InvalidCredentialsError);
    expect(malformedEmail).toBeInstanceOf(InvalidCredentialsError);
    expect(unknownEmail.message).toBe(wrongPassword.message);
    expect(malformedEmail.message).toBe(wrongPassword.message);
  });

  it('issues a new token family per login, so revoking one session leaves the other alone', async () => {
    const first = await login.execute({ email: 'owner@example.com', password: PASSWORD });
    const second = await login.execute({ email: 'owner@example.com', password: PASSWORD });

    const families = new Set(refreshTokens.all().map((token) => token.familyId.value));
    expect(first.refreshToken).not.toBe(second.refreshToken);
    // register + two logins = three distinct families
    expect(families.size).toBe(3);
  });
});
