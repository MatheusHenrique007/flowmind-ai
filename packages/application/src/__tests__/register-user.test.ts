import { InvalidEmailError, WeakPasswordError } from '@flowmind/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import { EmailAlreadyRegisteredError } from '../errors/email-already-registered-error.js';
import { RegisterUser } from '../use-cases/register-user.js';

import { FakeClock } from './fakes/fake-clock.js';
import { FakeRefreshTokenRepository } from './fakes/fake-refresh-token-repository.js';
import { FakeTokenService } from './fakes/fake-token-service.js';
import { FakeAccountStore } from './fakes/fake-user-repository.js';

describe('RegisterUser', () => {
  let store: FakeAccountStore;
  let refreshTokens: FakeRefreshTokenRepository;
  let tokenService: FakeTokenService;
  let useCase: RegisterUser;

  beforeEach(() => {
    store = new FakeAccountStore();
    refreshTokens = new FakeRefreshTokenRepository();
    tokenService = new FakeTokenService();
    useCase = new RegisterUser(
      store.userRepository,
      store.workspaceRepository,
      refreshTokens,
      tokenService,
      new FakeClock(),
    );
  });

  it('creates the user and its workspace together, and returns a session', async () => {
    const session = await useCase.execute({
      email: 'owner@example.com',
      password: 'correct horse battery',
    });

    expect(store.users.size).toBe(1);
    expect(store.workspaces.size).toBe(1);
    expect(session.user.email).toBe('owner@example.com');
    expect(session.accessToken).not.toBe('');
    expect(session.refreshToken).not.toBe('');
  });

  it('gives the new user its own workspace, owned by that user', async () => {
    const session = await useCase.execute({
      email: 'owner@example.com',
      password: 'correct horse battery',
    });

    const workspace = store.workspaces.get(session.user.workspaceId);
    expect(workspace).toBeDefined();
    expect(workspace?.ownerUserId.value).toBe(session.user.id);
  });

  it('gives two registrations two different workspaces', async () => {
    const first = await useCase.execute({ email: 'a@example.com', password: 'password-one' });
    const second = await useCase.execute({ email: 'b@example.com', password: 'password-two' });

    expect(first.user.workspaceId).not.toBe(second.user.workspaceId);
  });

  it('never stores the plaintext password', async () => {
    await useCase.execute({ email: 'owner@example.com', password: 'correct horse battery' });

    const stored = [...store.users.values()][0]!;
    expect(stored.passwordHash.value).not.toContain('correct horse battery');
    await expect(stored.verifyPassword('correct horse battery')).resolves.toBe(true);
  });

  it('stores only the SHA-256 hash of the refresh token, never the raw value', async () => {
    const session = await useCase.execute({
      email: 'owner@example.com',
      password: 'correct horse battery',
    });

    const stored = refreshTokens.all();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).not.toBe(session.refreshToken);
    expect(stored[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a duplicate email (case-insensitively) without creating a second workspace', async () => {
    await useCase.execute({ email: 'owner@example.com', password: 'correct horse battery' });

    await expect(
      useCase.execute({ email: 'Owner@Example.com', password: 'another password' }),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
    expect(store.users.size).toBe(1);
    expect(store.workspaces.size).toBe(1);
  });

  it('rejects an invalid email address', async () => {
    await expect(
      useCase.execute({ email: 'not-an-email', password: 'correct horse battery' }),
    ).rejects.toThrow(InvalidEmailError);
    expect(store.users.size).toBe(0);
  });

  it('rejects a weak password and persists nothing', async () => {
    await expect(
      useCase.execute({ email: 'owner@example.com', password: 'short' }),
    ).rejects.toThrow(WeakPasswordError);
    expect(store.users.size).toBe(0);
    expect(store.workspaces.size).toBe(0);
  });
});
