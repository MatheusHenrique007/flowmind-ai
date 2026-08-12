export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface AuthenticatedUserDto {
  id: string;
  email: string;
  workspaceId: string;
}

export interface SessionDto {
  accessToken: string;
  user: AuthenticatedUserDto;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
    throw new Error(message ?? `Request failed with status ${response.status}.`);
  }
  return body as T;
}

/**
 * Every auth call sends `credentials: 'include'` — the refresh token lives in
 * an httpOnly cookie the browser will only attach when asked to, and JavaScript
 * can neither read nor set it. The access token in the response body is kept in
 * memory by AuthProvider and never written to localStorage (ADR-0003).
 */
export async function register(input: { email: string; password: string }): Promise<SessionDto> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  return parseOrThrow<SessionDto>(response);
}

export async function login(input: { email: string; password: string }): Promise<SessionDto> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  return parseOrThrow<SessionDto>(response);
}

/**
 * Returns null instead of throwing when there is no usable session: on first
 * load "not logged in" is the expected answer, not an error to surface.
 */
export async function refresh(): Promise<SessionDto | null> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // The API being unreachable (offline, not yet started, network error) is
    // the same outcome as an explicit "no session": there is nothing to
    // restore. Left uncaught, this would reject the promise AuthProvider
    // awaits on mount and leave `status` stuck at 'loading' forever instead
    // of falling through to the anonymous/login state.
    return null;
  }
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as SessionDto;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(
    () => undefined,
  );
}
