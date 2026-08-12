import type { AccessTokenClaims, TokenService } from '../../ports/token-service.js';

/**
 * Not a JWT — the point of the port is that Application never depends on how
 * a token is signed. Real signing/verification (jose + secret) is covered by
 * JoseTokenService's own tests in Infrastructure.
 */
export class FakeTokenService implements TokenService {
  private readonly issued = new Map<string, AccessTokenClaims>();
  private counter = 0;

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    const token = `fake-access-token-${++this.counter}`;
    this.issued.set(token, claims);
    return token;
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
    return this.issued.get(token) ?? null;
  }
}
