'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from './auth-provider';

/**
 * Shared by /login and /register — the two pages differ only in which auth
 * action they call and in their copy, so duplicating the form would just be two
 * places to fix the next accessibility or error-handling detail.
 */
export function CredentialsForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register, status } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Someone who already has a session has no business on these pages.
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ email, password });
      }
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const isRegister = mode === 'register';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            {isRegister ? 'Create your account' : 'Sign in'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isRegister
              ? 'You get your own workspace — only you can see its workflows.'
              : 'Welcome back to FlowMind AI.'}
          </p>
        </div>

        <label className="block text-sm">
          <span className="text-slate-700">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-700">Password</span>
          <input
            type="password"
            name="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            minLength={isRegister ? 8 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          {isRegister && (
            <span className="mt-1 block text-xs text-slate-500">At least 8 characters.</span>
          )}
        </label>

        {error && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-slate-500">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-slate-900 underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              No account yet?{' '}
              <Link href="/register" className="font-medium text-slate-900 underline">
                Create one
              </Link>
            </>
          )}
        </p>
      </form>
    </main>
  );
}
