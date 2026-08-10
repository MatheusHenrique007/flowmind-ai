import type { AccessTokenClaims, TokenService } from '@flowmind/application';
import { SignJWT, jwtVerify } from 'jose';

const ALGORITHM = 'HS256';
export const DEFAULT_ACCESS_TOKEN_TTL = '15m';

/**
 * The only place allowed to import `jose` — Application depends on the
 * TokenService port, never on the JWT library or on the signing secret.
 *
 * HS256 with a shared secret (not RS256): a single service both issues and
 * verifies these tokens this release, so asymmetric keys would add key
 * distribution for no benefit. See docs/adr/0003-authentication-token-strategy.md.
 */
export class JoseTokenService implements TokenService {
  private readonly secret: Uint8Array;
  private readonly ttl: string;
  private readonly issuer = 'flowmind-api';

  constructor(params: { secret: string; ttl?: string }) {
    if (params.secret.length < 32) {
      // Fail at construction, not on the first login: a short secret makes
      // every token forgeable and must never reach production silently.
      throw new Error('Access token secret must be at least 32 characters.');
    }
    this.secret = new TextEncoder().encode(params.secret);
    this.ttl = params.ttl ?? DEFAULT_ACCESS_TOKEN_TTL;
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ workspaceId: claims.workspaceId })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(claims.userId)
      .setIssuer(this.issuer)
      .setIssuedAt()
      .setExpirationTime(this.ttl)
      .sign(this.secret);
  }

  /**
   * Returns null rather than throwing for every rejection — expired,
   * mis-signed, malformed, or missing claims all mean the same thing to the
   * caller (401), and an exception-based contract invites a route forgetting
   * to catch one of the cases.
   */
  async verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: [ALGORITHM],
        issuer: this.issuer,
      });

      const userId = payload.sub;
      const workspaceId = payload.workspaceId;
      if (typeof userId !== 'string' || typeof workspaceId !== 'string') {
        return null;
      }
      if (userId.length === 0 || workspaceId.length === 0) {
        return null;
      }

      return { userId, workspaceId };
    } catch {
      return null;
    }
  }
}
