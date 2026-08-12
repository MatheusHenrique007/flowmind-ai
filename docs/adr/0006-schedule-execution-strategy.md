# 0006 — Schedule Execution Strategy: BullMQ Job Scheduler, Ordering-Based Consistency

- **Status**: Accepted
- **Date**: 2026-08-12

## Context

Release v0.6.0 adds a recurring trigger (`Schedule`) that must enqueue `WorkflowExecutionJobData`
jobs on a cron cadence, reusing the exact `workflow-execution` Queue and Worker webhook-triggered
runs already use (see `docs/prd/v0.6.0-scheduling.md`). Two questions had to be settled before
writing any code:

1. **How does a Schedule register a recurring job with BullMQ 5.81.3, without the deprecated
   `repeat` option?** BullMQ's `Queue.d.ts` (read directly from
   `node_modules/.pnpm/bullmq@5.81.3/node_modules/bullmq/dist/esm/classes/queue.d.ts` before writing
   any adapter code) confirms `repeat` on `.add()` is superseded by the Job Scheduler API:
   `upsertJobScheduler(jobSchedulerId: NameType, repeatOpts: Omit<RepeatOptions, 'key'>, jobTemplate?:
{ name?, data?, opts? }): Promise<Job>` and `removeJobScheduler(jobSchedulerId: string):
Promise<boolean>`. `getJobScheduler(id)` returns a `JobSchedulerJson` that already exposes `next`
   — a Unix-ms timestamp for the next scheduled run, computed by BullMQ itself from the cron
   pattern — which means `nextRunAt` needs no separate cron-parser dependency; reading it directly
   off the job scheduler's own state is simpler and can never drift from what BullMQ will actually
   do.
2. **Postgres (the Schedule row) and Redis/BullMQ (the job scheduler registration) have no shared
   transaction.** Any two-step create or delete can fail between its two steps, leaving one system
   updated and the other not. What ordering and compensation makes the failure modes acceptable
   without a saga framework, an intermediate status column, or a background reconciliation job —
   all deliberately rejected as more machinery than this release's actual risk warrants?

## Decision

1. **Registration uses BullMQ's Job Scheduler API exclusively** —
   `queue.upsertJobScheduler(schedule.id.value, { pattern: schedule.cronExpression }, { name:
WORKFLOW_EXECUTION_QUEUE_NAME, data: {...} })` to create/update, `queue.removeJobScheduler(id)` to
   remove. The job scheduler id is the Schedule's own id — a schedule already carries workflowId/
   workspaceId/cronExpression, so registration needs no separate lookup or state.
2. **Exactly one BullMQ Queue instance backs both webhook and Schedule execution.** Infrastructure's
   `createWorkflowExecutionQueue(connection)` is now the single factory for the
   `workflow-execution` Queue; `BullMQWorkflowQueue` (one-shot webhook enqueues, unchanged
   behavior) and the new `BullMQScheduleQueue` (recurring registration) are two separate adapters
   over that one instance, constructed once in `composition-root.ts`. Neither the Engine nor the
   Worker (`start-workflow-worker.ts`) changes: a job produced by a Schedule is structurally
   identical to a job produced by a webhook enqueue, plus one new optional `scheduleId` field the
   Worker's handler never reads (present only so a later release can distinguish scheduled from
   webhook-triggered runs without another payload migration).
3. **CreateSchedule: persist to Postgres FIRST, then register with BullMQ.** If registration
   throws, best-effort delete the just-created Postgres row (swallowing a compensation failure —
   it must never mask the original error), then raise `ScheduleRegistrationFailedError` wrapping
   the cause. **Why this order**: the worst outcome this strategy must never allow is an active
   recurring BullMQ job with no Postgres row to trace or stop it — an untraceable, permanently
   recurring execution. Persisting first means that specific outcome cannot happen; the residual
   failure mode (compensation itself also fails) only ever leaves a harmless orphan Postgres row
   with no matching queue registration, discoverable and safely re-deletable.
4. **DeleteSchedule: unregister from BullMQ FIRST, then delete the Postgres row.** If
   unregistration throws, abort entirely — Postgres is never touched, the Schedule stays intact and
   active, and the caller can retry the whole delete. **Why this order**: the worst residual outcome
   this produces is BullMQ removal succeeding while the Postgres delete then fails — a harmless
   zombie row, self-healing on a retried delete because `removeJobScheduler` on an already-removed
   id is a documented safe no-op (verified directly: `bullmq-schedule-queue.test.ts` unregisters an
   id that was never registered and asserts no throw).
5. **No saga framework, no intermediate status column on Schedule, no background reconciliation
   job.** The two orderings above, plus their single compensation step each, are the entire
   consistency mechanism. Nothing else is built.
6. **`workspaceId` always travels with the job, never re-derived.** Exactly like
   `WorkflowExecutionJobData.workspaceId` already works for webhook enqueues (the Worker runs
   outside any HTTP request and has no session), a Schedule's registered job template carries
   `workspaceId` captured at registration time.
7. **Deleting a Schedule never cancels a run already enqueued or executing.** This is
   `removeJobScheduler`'s native, documented behavior (it stops future occurrences only) — nothing
   is added on top of it to make deletion "more aggressive." A Schedule's Prisma relation to
   Workflow has `onDelete: Cascade` (deleting a Workflow row leaves no dangling Schedule row); its
   relation to Workspace does not cascade, matching how `Workflow -> Workspace` is already modeled
   (Workspaces are never deleted this release).
8. **Cron expressions are UTC only, this release.** No timezone field on `Schedule`, the API, or
   the frontend — BullMQ's `RepeatOptions` accepts an optional `tz`, deliberately left unset. Stated
   explicitly in the frontend's disclaimer text.
9. **Cron structural validation lives in Domain (`Schedule.create`); `nextRunAt` computation lives
   in Infrastructure, not Domain or Application.** Domain validates the expression's shape (5
   fields, correct numeric ranges) with a hand-rolled check — no cron-parser dependency added to
   Domain. `nextRunAt` is a read of BullMQ's own live job-scheduler state
   (`compute-next-run.ts`), which is inherently an Infrastructure concern: it depends on what the
   queue backend itself has already resolved, not on re-deriving it from the cron string alone.
   `ListSchedules` (Application) returns plain `Schedule[]`; the API route attaches `nextRunAt` by
   calling Infrastructure's `computeNextRunAt` directly per schedule when shaping the HTTP
   response, rather than giving the Application layer's `ScheduleRepository` (a Postgres-only
   port) a dependency on `ScheduleQueue` for one read-only convenience field.

## Consequences

**Positive**

- The only two failure windows this system can ever be caught in — "Postgres has a row, BullMQ
  registration failed" and "BullMQ still has a scheduler, Postgres delete failed" — are both
  reduced to a harmless, self-describing orphan/zombie row, never to an untraceable recurring job.
- Zero changes to `packages/engine` or the Worker; `git diff --stat -- packages/engine` is empty,
  and `start-workflow-worker.ts`'s diff is at most the type of one already-unused field.
- Exactly one BullMQ Queue instance exists for `workflow-execution` — confirmed directly by reading
  `create-workflow-queue.ts`'s single `createWorkflowExecutionQueue` factory and
  `composition-root.ts`'s single call site.

**Negative / trade-offs**

- A double failure (Postgres write succeeds, BullMQ registration fails, _and_ the compensating
  delete also fails) leaves an orphan Schedule row with no active registration — a workspace could
  see a Schedule listed that never actually fires. This is the deliberate, accepted trade-off:
  building anything to auto-detect and reconcile this (a background job, a status column) is more
  machinery than a rare double-failure warrants; the row is harmless and visibly re-deletable by
  the same DELETE endpoint (which no-ops cleanly on BullMQ's side and still removes the row).
- A double failure in the opposite direction (BullMQ unregister succeeds, Postgres delete fails)
  leaves a zombie row a user might see as still "active" until they retry the delete. Retrying is
  the intended remedy — `removeJobScheduler` on an already-gone id is a safe no-op, so retrying
  never errors.
- `nextRunAt` requires a live Redis round-trip per Schedule in `GET /schedules` (no caching this
  release) — acceptable at the 20-schedule-per-workspace ceiling this release also introduces.

## Alternatives considered

- **A saga / outbox pattern with an intermediate `PENDING`/`ACTIVE`/`FAILED` status column and a
  background reconciler**: rejected. This is a real technique for real dual-write problems, but at
  this release's scale (single ordering, single compensation step, no multi-step workflow of
  writes) it is strictly more code and more failure surface than the ordering-plus-compensation
  rule above, which already eliminates the one outcome that actually matters (untraceable
  recurring jobs).
- **BullMQ's deprecated `repeat` option on `.add()`**: rejected outright — it is scheduled for
  removal in BullMQ v6, and the installed 5.81.3 already ships the superseding Job Scheduler API
  used here.
- **A second BullMQ Queue dedicated to Schedules**: rejected — Schedules and webhooks both need to
  land in the exact same `workflow-execution` queue name the existing Worker already drains;
  introducing a second queue would require either a second Worker (explicitly out of scope) or
  cross-queue routing logic that solves nothing the existing single queue doesn't already handle.
- **cron-parser (or any dependency) for computing `nextRunAt`**: rejected — BullMQ's own
  `JobSchedulerJson.next` already exposes the value the queue backend will actually act on; adding
  a second cron-resolution implementation risks it disagreeing with BullMQ's own interpretation of
  the same pattern.
- **Timezone support this release**: rejected — no proven demand yet, and UTC-only keeps
  `nextRunAt` a pure read of BullMQ state with no timezone-conversion logic anywhere in this
  release's code. Deferred cleanly: BullMQ's `RepeatOptions.tz` already exists for a future release
  to adopt without a storage migration.
