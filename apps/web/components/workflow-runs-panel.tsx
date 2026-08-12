'use client';

import { useEffect, useState } from 'react';

import { getWorkflowRun, listWorkflowRuns } from '../lib/api-client';
import type { WorkflowRunDto, WorkflowStepResultDto } from '../lib/workflow-dto';

interface WorkflowRunsPanelProps {
  workflowId: string;
  /** Bump this (e.g. after Execute completes) to force a refetch of the run list. */
  refreshSignal?: number;
}

type ListState =
  | { status: 'loading' }
  | { status: 'loaded'; runs: WorkflowRunDto[] }
  | { status: 'error'; message: string };

type DetailState =
  | { status: 'idle' }
  | { status: 'loading'; runId: string }
  | { status: 'loaded'; run: WorkflowRunDto }
  | { status: 'error'; runId: string; message: string };

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

/** Computed client-side from startedAt/finishedAt — no new backend field for this. */
function formatDuration(startedAt?: string, finishedAt?: string): string {
  if (!startedAt || !finishedAt) return '—';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_STYLES: Record<string, string> = {
  SUCCEEDED: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-red-50 text-red-700',
  RUNNING: 'bg-amber-50 text-amber-700',
  PENDING: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {status}
    </span>
  );
}

function StepResultRow({ step }: { step: WorkflowStepResultDto }) {
  return (
    <li className="rounded border border-slate-200 p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-slate-700">{step.stepId}</span>
        <StatusBadge status={step.status} />
      </div>
      {step.output !== undefined && (
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-slate-600">
          {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
        </pre>
      )}
      {step.error && (
        <p className="mt-1 whitespace-pre-wrap break-words text-red-700">{step.error}</p>
      )}
    </li>
  );
}

function RunDetail({ run }: { run: WorkflowRunDto }) {
  return (
    <div className="border-t border-slate-200 bg-slate-50 px-3 py-3">
      <p className="mb-2 text-xs text-slate-500">
        {run.stepResults.length} step{run.stepResults.length === 1 ? '' : 's'} recorded
      </p>
      {run.stepResults.length === 0 ? (
        <p className="text-xs text-slate-500">No step results were recorded for this run.</p>
      ) : (
        <ul className="space-y-2">
          {run.stepResults.map((step, index) => (
            <StepResultRow key={`${step.stepId}-${index}`} step={step} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Run history for a single workflow, embedded in its own page (/workflows/[id])
 * per v0.8.0's scope — there is no separate observability area. Fetches
 * GET /workflow-runs and filters client-side by workflowId, since the
 * endpoint has no server-side filter param.
 */
export function WorkflowRunsPanel({ workflowId, refreshSignal }: WorkflowRunsPanelProps) {
  const [listState, setListState] = useState<ListState>({ status: 'loading' });
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<DetailState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    setListState({ status: 'loading' });
    void (async () => {
      try {
        const runs = await listWorkflowRuns();
        if (cancelled) return;
        const forThisWorkflow = runs
          .filter((run) => run.workflowId === workflowId)
          .sort(
            (a, b) => new Date(b.startedAt ?? 0).getTime() - new Date(a.startedAt ?? 0).getTime(),
          );
        setListState({ status: 'loaded', runs: forThisWorkflow });
      } catch (cause) {
        if (!cancelled) {
          setListState({
            status: 'error',
            message: cause instanceof Error ? cause.message : 'Failed to load run history.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // refreshSignal is a deliberate re-fetch trigger, not itself displayed.
  }, [workflowId, refreshSignal]);

  async function toggleRun(runId: string) {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);
    setDetailState({ status: 'loading', runId });
    try {
      const run = await getWorkflowRun(runId);
      setDetailState({ status: 'loaded', run });
    } catch (cause) {
      setDetailState({
        status: 'error',
        runId,
        message: cause instanceof Error ? cause.message : 'Failed to load run detail.',
      });
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white">
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Run history</h2>
      </div>

      {listState.status === 'loading' && (
        <p className="px-4 pb-3 text-sm text-slate-500">Loading run history…</p>
      )}
      {listState.status === 'error' && (
        <p className="px-4 pb-3 text-sm text-red-700">{listState.message}</p>
      )}
      {listState.status === 'loaded' && listState.runs.length === 0 && (
        <p className="px-4 pb-3 text-sm text-slate-500">
          No runs yet — click Execute above to run this workflow.
        </p>
      )}
      {listState.status === 'loaded' && listState.runs.length > 0 && (
        <ul className="divide-y divide-slate-200 border-t border-slate-100">
          {listState.runs.map((run) => (
            <li key={run.id}>
              <button
                onClick={() => void toggleRun(run.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <StatusBadge status={run.status} />
                  <span className="text-slate-700">{formatDateTime(run.startedAt)}</span>
                </span>
                <span className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{formatDuration(run.startedAt, run.finishedAt)}</span>
                  <span>
                    {run.stepResults.length} step{run.stepResults.length === 1 ? '' : 's'}
                  </span>
                </span>
              </button>
              {expandedRunId === run.id && detailState.status === 'loading' && (
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                  Loading run detail…
                </div>
              )}
              {expandedRunId === run.id && detailState.status === 'error' && (
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-red-700">
                  {detailState.message}
                </div>
              )}
              {expandedRunId === run.id && detailState.status === 'loaded' && (
                <RunDetail run={detailState.run} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
