import type { FastifyReply, FastifyRequest } from 'fastify';

export const REFRESH_COOKIE_NAME = 'flowmind_refresh';

/**
 * Cookie handling is written out by hand rather than pulling in
 * @fastify/cookie: this release adds exactly one cookie, read on exactly one
 * route, and ADR-0003 approved exactly one new dependency (`jose`). Signing
 * and parsing a whole cookie jar is not needed — the value is an opaque,
 * high-entropy token whose integrity is guaranteed by the database lookup.
 */
export function readRefreshCookie(request: FastifyRequest): string | undefined {
  const header = request.headers.cookie;
  if (!header) {
    return undefined;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    if (part.slice(0, separator).trim() !== REFRESH_COOKIE_NAME) {
      continue;
    }
    const value = part.slice(separator + 1).trim();
    return value.length > 0 ? decodeURIComponent(value) : undefined;
  }

  return undefined;
}

/**
 * httpOnly (unreadable by JavaScript, so XSS cannot exfiltrate it), Secure,
 * SameSite=Lax (blocks the cookie on cross-site POSTs, which is what stands in
 * for a CSRF token this release — see ADR-0003), and Path=/auth so it is only
 * ever sent to the auth endpoints that need it.
 *
 * `Secure` is omitted in development because browsers reject Secure cookies on
 * plain http://localhost for a non-HTTPS origin; it is always set otherwise.
 */
export function setRefreshCookie(
  reply: FastifyReply,
  params: { token: string; expiresAt: Date; secure: boolean },
): void {
  const attributes = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(params.token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/auth',
    `Expires=${params.expiresAt.toUTCString()}`,
  ];
  if (params.secure) {
    attributes.push('Secure');
  }
  reply.header('set-cookie', attributes.join('; '));
}

export function clearRefreshCookie(reply: FastifyReply, params: { secure: boolean }): void {
  const attributes = [
    `${REFRESH_COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/auth',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (params.secure) {
    attributes.push('Secure');
  }
  reply.header('set-cookie', attributes.join('; '));
}
