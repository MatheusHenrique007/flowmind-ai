'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setAccessToken, setSessionLostHandler } from '../lib/access-token-store';
import {
  login as loginRequest,
  logout as logoutRequest,
  refresh as refreshRequest,
  register as registerRequest,
  type AuthenticatedUserDto,
} from '../lib/auth-api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUserDto | null;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the session in React state, and the access token itself in the
 * module-scoped store (memory only — never localStorage; see ADR-0003).
 *
 * On mount it attempts one silent refresh: after a page reload the in-memory
 * token is gone, but the httpOnly refresh cookie is not, so an existing session
 * can be restored without asking for the password again.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUserDto | null>(null);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    let cancelled = false;

    setSessionLostHandler(() => {
      if (!cancelled) {
        clearSession();
      }
    });

    void (async () => {
      const session = await refreshRequest();
      if (cancelled) {
        return;
      }
      if (session) {
        setAccessToken(session.accessToken);
        setUser(session.user);
        setStatus('authenticated');
      } else {
        clearSession();
      }
    })();

    return () => {
      cancelled = true;
      setSessionLostHandler(null);
    };
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login: async (input) => {
        const session = await loginRequest(input);
        setAccessToken(session.accessToken);
        setUser(session.user);
        setStatus('authenticated');
      },
      register: async (input) => {
        const session = await registerRequest(input);
        setAccessToken(session.accessToken);
        setUser(session.user);
        setStatus('authenticated');
      },
      logout: async () => {
        // Clear locally even if the request fails — the user asked to be logged
        // out, and the refresh token is revoked server-side on any successful call.
        await logoutRequest();
        clearSession();
      },
    }),
    [status, user, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return context;
}

/**
 * Renders `children` only for an authenticated visitor; anyone else is sent to
 * /login. The redirect happens in an effect (not during render) because Next's
 * router cannot be navigated while rendering.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        {status === 'loading' ? 'Loading your workspace…' : 'Redirecting to sign in…'}
      </div>
    );
  }

  return <>{children}</>;
}
