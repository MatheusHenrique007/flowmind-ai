'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from './auth-provider';

export function WorkspaceHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    await logout();
    router.replace('/login');
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
      <div className="text-sm text-slate-600">
        <span className="font-medium text-slate-900">{user?.email}</span>
        <span className="ml-2 text-xs text-slate-400">workspace {user?.workspaceId}</span>
      </div>
      <button
        onClick={handleLogout}
        disabled={signingOut}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
      >
        {signingOut ? 'Signing out…' : 'Log out'}
      </button>
    </header>
  );
}
