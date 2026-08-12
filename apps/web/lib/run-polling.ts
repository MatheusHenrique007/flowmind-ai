import { getWorkflowRun, listWorkflowRuns } from './api-client';
import type { WorkflowRunDto } from './workflow-dto';

/**
 * Polling strategy for "what happened after I clicked Execute", without a
 * WebSocket/SSE channel and without changing POST /webhooks/:workflowId's
 * `{ accepted: true }` response (which carries no run id).
 *
 * Two phases:
 *  1. "Find the run" — poll GET /workflow-runs (there is no server-side
 *     filter-by-workflowId, so we filter the array client-side) until a run
 *     id shows up for this workflow that wasn't in the pre-execute snapshot.
 *  2. "Watch the run" — once identified, poll GET /workflow-runs/:id
 *     specifically until it reaches a terminal status.
 *
 * Interval/timeout: 1.5s between polls, 75s total. 1.5s is frequent enough to
 * feel live without hammering the API; 75s is generously above the couple of
 * seconds a MockAIProvider run takes end-to-end (webhook -> queue -> worker),
 * while still bounding the loop instead of polling forever if the Worker is
 * stuck or the queue is backed up.
 */
export const POLL_INTERVAL_MS = 1500;
export const POLL_TIMEOUT_MS = 75_000;

const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED']);

export function isTerminalStatus(status: WorkflowRunDto['status']): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Snapshot of run ids that already exist for `workflowId`, taken before Execute is clicked. */
export async function snapshotRunIds(workflowId: string): Promise<Set<string>> {
  const runs = await listWorkflowRuns();
  return new Set(runs.filter((run) => run.workflowId === workflowId).map((run) => run.id));
}

export class RunPollingTimeoutError extends Error {
  constructor() {
    super('Timed out waiting for the workflow run to appear or finish.');
    this.name = 'RunPollingTimeoutError';
  }
}

export class RunPollingCancelledError extends Error {
  constructor() {
    super('Polling was cancelled.');
    this.name = 'RunPollingCancelledError';
  }
}

export interface PollForRunOptions {
  intervalMs?: number;
  timeoutMs?: number;
  /** Called each time a new snapshot of the target run is fetched, including non-terminal ones. */
  onUpdate?: (run: WorkflowRunDto) => void;
}

export interface PollHandle {
  promise: Promise<WorkflowRunDto>;
  cancel: () => void;
}

/**
 * Runs the two-phase strategy described above and resolves with the run once
 * it reaches a terminal status. Rejects with RunPollingTimeoutError if the
 * deadline passes first, or RunPollingCancelledError if `cancel()` was called
 * (e.g. the component using this unmounted).
 */
export function pollForRunCompletion(
  workflowId: string,
  knownRunIds: Set<string>,
  options: PollForRunOptions = {},
): PollHandle {
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? POLL_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    cancelled = true;
    if (timer) {
      clearTimeout(timer);
    }
  };

  const promise = new Promise<WorkflowRunDto>((resolve, reject) => {
    async function findNewRun(): Promise<WorkflowRunDto | null> {
      const runs = await listWorkflowRuns();
      const candidates = runs
        .filter((run) => run.workflowId === workflowId && !knownRunIds.has(run.id))
        // Edge case: more than one new run appears in the same poll window
        // (e.g. a Schedule fires at the same moment) — pick the earliest by
        // startedAt as a tiebreak. Accepted residual limitation: if the
        // schedule's run finishes before the user's, the UI will follow the
        // wrong one; out of scope to disambiguate further this release.
        .sort(
          (a, b) => new Date(a.startedAt ?? 0).getTime() - new Date(b.startedAt ?? 0).getTime(),
        );
      return candidates[0] ?? null;
    }

    async function watchRun(runId: string): Promise<void> {
      for (;;) {
        if (cancelled) {
          reject(new RunPollingCancelledError());
          return;
        }
        if (Date.now() > deadline) {
          reject(new RunPollingTimeoutError());
          return;
        }
        const run = await getWorkflowRun(runId);
        options.onUpdate?.(run);
        if (isTerminalStatus(run.status)) {
          resolve(run);
          return;
        }
        await sleep(intervalMs);
      }
    }

    async function findThenWatch(): Promise<void> {
      for (;;) {
        if (cancelled) {
          reject(new RunPollingCancelledError());
          return;
        }
        if (Date.now() > deadline) {
          reject(new RunPollingTimeoutError());
          return;
        }
        const found = await findNewRun();
        if (found) {
          if (isTerminalStatus(found.status)) {
            options.onUpdate?.(found);
            resolve(found);
            return;
          }
          await watchRun(found.id);
          return;
        }
        await sleep(intervalMs);
      }
    }

    function sleep(ms: number): Promise<void> {
      return new Promise((resolveSleep) => {
        timer = setTimeout(resolveSleep, ms);
      });
    }

    findThenWatch().catch(reject);
  });

  return { promise, cancel };
}
