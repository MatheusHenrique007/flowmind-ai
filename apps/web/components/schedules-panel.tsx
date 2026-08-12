'use client';

import { useEffect, useState } from 'react';

import { createSchedule, deleteSchedule, listSchedules } from '../lib/schedule-api';
import type { ScheduleDto } from '../lib/schedule-dto';

/**
 * Schedules the currently-saved Workflow — not a workflow picker. This
 * editor only ever knows about the one workflow it has loaded/saved (there
 * is no workflow list anywhere else in the frontend yet), so a dropdown
 * would be dishonest about what the app can actually do; the simplest
 * truthful UI is "schedule this workflow".
 *
 * No timezone picker anywhere here: cron expressions are always interpreted
 * in UTC this release (see ADR-0006) — the disclaimer below is the only UI
 * a user gets for that fact.
 */
export function SchedulesPanel({ workflowId }: { workflowId: string }) {
  const [schedules, setSchedules] = useState<ScheduleDto[]>([]);
  const [cronExpression, setCronExpression] = useState('0 * * * *');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    try {
      const all = await listSchedules();
      setSchedules(all.filter((s) => s.workflowId === workflowId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load schedules.');
    }
  }

  useEffect(() => {
    void refresh();
  }, [workflowId]);

  async function handleCreate() {
    setError(null);
    setLoading(true);
    try {
      await createSchedule({ workflowId, cronExpression });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create the schedule.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteSchedule(id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete the schedule.');
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      <h2 className="text-sm font-semibold text-slate-800">Schedules</h2>
      <p className="mt-1 text-xs text-slate-500">
        Cron expressions are evaluated in UTC — there is no timezone setting this release. Runs use
        whatever AI provider this workspace is configured with (the mock provider if none).
      </p>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={cronExpression}
          onChange={(event) => setCronExpression(event.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="* * * * * (UTC)"
        />
        <button
          onClick={handleCreate}
          disabled={loading}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add schedule
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <ul className="mt-3 space-y-1">
        {schedules.map((schedule) => (
          <li
            key={schedule.id}
            className="flex items-center justify-between rounded border border-slate-200 px-2 py-1 text-sm"
          >
            <span>
              <code className="font-mono">{schedule.cronExpression}</code>
              {' — Next run: '}
              {schedule.nextRunAt ? `${schedule.nextRunAt} UTC` : 'unknown'}
            </span>
            <button
              onClick={() => handleDelete(schedule.id)}
              className="text-xs font-medium text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </li>
        ))}
        {schedules.length === 0 && <li className="text-xs text-slate-400">No schedules yet.</li>}
      </ul>
    </div>
  );
}
