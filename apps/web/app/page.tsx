'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { RequireAuth } from '../components/auth-provider';
import { WorkspaceHeader } from '../components/workspace-header';
import { listWorkflows } from '../lib/api-client';
import type { WorkflowSummaryDto } from '../lib/workflow-dto';

type ListState =
  | { status: 'loading' }
  | { status: 'loaded'; workflows: WorkflowSummaryDto[] }
  | { status: 'error'; message: string };

function WorkflowsList() {
  const [state, setState] = useState<ListState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const workflows = await listWorkflows();
        if (!cancelled) {
          setState({ status: 'loaded', workflows });
        }
      } catch (cause) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: cause instanceof Error ? cause.message : 'Failed to load workflows.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">My Workflows</h1>
        <Link
          href="/workflows/new"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          New Workflow
        </Link>
      </div>

      {state.status === 'loading' && (
        <p className="text-sm text-slate-500">Loading your workflows…</p>
      )}
      {state.status === 'error' && <p className="text-sm text-red-700">{state.message}</p>}
      {state.status === 'loaded' && state.workflows.length === 0 && (
        <p className="text-sm text-slate-500">
          You have not created any workflows yet. Click "New Workflow" to get started.
        </p>
      )}
      {state.status === 'loaded' && state.workflows.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {state.workflows.map((workflow) => (
            <li key={workflow.id}>
              <Link
                href={`/workflows/${workflow.id}`}
                className="block px-4 py-3 text-sm text-slate-900 hover:bg-slate-50"
              >
                {workflow.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * "My Workflows" list — the app's new landing page (v0.7.0). The editor moved
 * to /workflows/new and /workflows/[id]; this route only lists and links.
 */
export default function HomePage() {
  return (
    <RequireAuth>
      <div className="flex h-screen flex-col overflow-y-auto">
        <WorkspaceHeader />
        <WorkflowsList />
      </div>
    </RequireAuth>
  );
}
