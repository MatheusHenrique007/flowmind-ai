import { refresh } from './auth-api';

/**
 * The access token lives here — a module-scoped variable, i.e. memory only.
 * Never localStorage/sessionStorage/a cookie readable by JS: a 15-minute
 * bearer token in storage survives page loads and is exactly what an XSS payload
 * would exfiltrate (ADR-0003). The cost is that a hard refresh has no token
 * until AuthProvider silently rotates the httpOnly refresh cookie.
 *
 * It is kept outside React state as well as in it, so `authorizedFetch` can read
 * the current token without every caller having to thread it through.
 */
let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Lets AuthProvider clear its own state when a refresh finally fails. */
export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}

/**
 * Sends the access token as a Bearer header and includes credentials so the
 * refresh cookie is available to the one endpoint that needs it.
 *
 * On a 401 it tries exactly one silent refresh and replays the request. One
 * attempt, not a loop: if the refreshed token is also rejected, the session is
 * genuinely gone and retrying would just spin.
 */
export async function authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const send = (): Promise<Response> =>
    fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.headers ?? {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

  const response = await send();
  if (response.status !== 401) {
    return response;
  }

  const session = await refresh();
  if (!session) {
    setAccessToken(null);
    onSessionLost?.();
    return response;
  }

  setAccessToken(session.accessToken);
  return send();
}
