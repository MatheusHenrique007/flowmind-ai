import { RefreshToken, RefreshTokenSecret, type TokenFamilyId, type User } from '@flowmind/domain';

import type { Clock } from '../ports/clock.js';
import type { RefreshTokenRepository } from '../ports/refresh-token-repository.js';
import type { TokenService } from '../ports/token-service.js';

/**
 * What every successful authentication (register, login, refresh) hands back.
 * `refreshToken` is the raw opaque value — the Presentation layer puts it in
 * an httpOnly cookie and nothing else; only its hash is ever persisted.
 */
export interface AuthenticatedSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
  readonly user: AuthenticatedUser;
}

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly workspaceId: string;
}

export const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id.value,
    email: user.email.value,
    workspaceId: user.workspaceId.value,
  };
}

/**
 * Mints one access token plus one refresh token for `user`, persisting only
 * the refresh token's SHA-256 hash. Shared by RegisterUser, LoginUser and
 * RefreshSession so all three issue sessions through exactly one code path —
 * a second, subtly-different implementation is precisely how a rotation or
 * hashing rule silently stops holding on one of them.
 */
export async function issueSession(params: {
  user: User;
  familyId: TokenFamilyId;
  tokenService: TokenService;
  refreshTokenRepository: RefreshTokenRepository;
  clock: Clock;
  refreshTokenTtlDays?: number;
}): Promise<AuthenticatedSession> {
  const ttlDays = params.refreshTokenTtlDays ?? DEFAULT_REFRESH_TOKEN_TTL_DAYS;
  const now = params.clock.now();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  const secret = RefreshTokenSecret.generate();
  await params.refreshTokenRepository.save(
    RefreshToken.create({
      userId: params.user.id,
      tokenHash: secret.hash,
      familyId: params.familyId,
      expiresAt,
      createdAt: now,
    }),
  );

  const accessToken = await params.tokenService.signAccessToken({
    userId: params.user.id.value,
    workspaceId: params.user.workspaceId.value,
  });

  return {
    accessToken,
    refreshToken: secret.value,
    refreshTokenExpiresAt: expiresAt,
    user: toAuthenticatedUser(params.user),
  };
}
