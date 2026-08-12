/**
 * Claims carried by an access token. `workspaceId` is here so authorization
 * never has to be re-derived from client input on a request — the auth
 * preHandler reads it straight out of the verified token (ADR-0003/0004).
 */
export interface AccessTokenClaims {
  readonly userId: string;
  readonly workspaceId: string;
}

/**
 * The one genuinely Infrastructure-backed auth port: signing a JWT needs an
 * external library (`jose`) and a secret from configuration. Password hashing
 * deliberately has no port — it is a Domain concern (PasswordHash).
 */
export interface TokenService {
  signAccessToken(claims: AccessTokenClaims): Promise<string>;
  /** Returns null — never throws — for a malformed, mis-signed, or expired token. */
  verifyAccessToken(token: string): Promise<AccessTokenClaims | null>;
}
