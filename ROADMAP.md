# Roadmap

FlowMind AI ships as **Releases** (`v0.1.0`, `v0.2.0`, ...), not internal sprints — each entry
below should read like a product milestone a user or a Tech Lead could understand, not an
engineering to-do list. See `docs/adr/0001-foundation-decisions.md` (Decision 6) for why.

Rules that gate every release closing (see [CONTRIBUTING.md](CONTRIBUTING.md) for full detail):

- **Foundation freeze**: infrastructure, stack, monorepo layout, CI, and architecture are frozen
  as of v0.1.0 — changed only for a critical bug, a security vulnerability, or a very large
  technical gain, never preference.
- **MVP rule**: a feature ships only if the honest answer to "will this be used in FlowMind's
  official demo?" is yes. No settings, billing, marketplace, teams, or advanced RBAC yet.
- **Demo rule**: if the release's result can't be demoed in under two minutes, it was scoped too
  large.
- **Recruiter rule**: before closing, ask "would a Tech Lead opening this repo today be
  impressed?" If not, it isn't done.
- **No technical debt carryover**: debt created in a release must be paid down in the very next
  one — never pushed further down the roadmap.
- Starting v0.2.0, validation extends past CI: `lint → typecheck → test → build → Smoke Test →
Demo Test`. Smoke Test confirms every runtime piece actually boots and connects (API, web,
  worker, Redis, Postgres); Demo Test is the two-minute-video check above.

This roadmap is intentionally coarse and undated beyond the current release — scope, not
calendar dates, is what we commit to.

## v0.1.0 — Foundation ✅

Monorepo scaffolding only, no product features. Nothing here is user-demoable by design — it's
the one release exempt from the demo rule, since "foundation exists and is green" is the
deliverable itself:

- pnpm workspaces + Turborepo, shared TypeScript/ESLint config
- Clean Architecture package skeletons (domain, application, infrastructure)
- Multi-provider AI abstraction skeleton (`ai-contracts`, `ai-factory`, provider stubs) — no
  vendor SDKs installed yet, since none are used yet
- Fastify API skeleton with a `/health` endpoint
- Next.js web app skeleton with a placeholder landing page
- Docker Compose for local Postgres/Redis
- CI (lint, typecheck, test, build, e2e), Husky/lint-staged/commitlint
- Foundational docs: architecture, ADR-0001, contributing, tech stack

Definition of Done for this release lives in `README.md`.

## v0.2.0 — Minimal end-to-end execution engine ✅

Full PRD: [docs/prd/v0.2.0-execution-engine.md](docs/prd/v0.2.0-execution-engine.md).

100% of effort goes into product features that move FlowMind AI toward a usable MVP — the
foundation is frozen (see above).

Goal: prove the execution engine works end-to-end with exactly **one** hardcoded use case — not
30, not a general-purpose engine yet. No visual editor. Demoable in under two minutes: fire the
webhook, watch the run happen, see the Slack message land.

- Fixed workflow: **Webhook trigger → Claude (summarize/classify) → Slack notification**
- Domain model for a minimal workflow/run/step
- A Workflow Engine that depends only on the `AIProvider` and new `Destination` contracts —
  never on `ClaudeProvider`/`SlackDestination` directly (ADR-0002); steps hand off through a
  shared `ExecutionContext`, never call each other directly
- New `packages/destinations/{contracts,slack}`, mirroring the `packages/ai/*` pattern
- Application use case to execute that single workflow
- Infrastructure adapters: webhook receiver, Claude via an injected resolver function (only
  `@flowmind/ai-claude` gets its vendor SDK installed — OpenAI/Gemini adapters stay stubs), Slack
  the same way. `@flowmind/ai-factory` exists but stayed an unwired stub — as-implemented, the
  composition root (`apps/api/src/composition-root.ts`) resolves providers/destinations directly
  via `() => concreteInstance` closures rather than through a factory package; a
  `destinations/factory` package was never created. Revisit once multiple providers/destinations
  actually need runtime selection (v0.3+).
- Just enough persistence (Prisma installed and wired here, not before) to record a workflow run
  and its steps, and to show a run history
- Tests covering the execution path

Once this works end to end, the same shape repeats for Email, then GitHub, then Notion — never
before this one is proven.

## v0.2.1 — Product Polish ✅

No product features, no architecture changes, no changes to Domain/Application/Engine/
Infrastructure business logic. Goal: turn the v0.2.0 technical MVP into something a recruiter (or
anyone) can clone, configure, and demo in under 10 minutes.

- Professional README (badges, architecture diagram, install/config/run instructions, roadmap)
- `pnpm demo` — one command: validates env, starts dependencies, seeds, runs the flow, reports
  the result clearly, including when AI/Slack credentials aren't set
- `pnpm seed` — populates the demo workflow, no manual `INSERT` ever required
- `.env.example` rewritten: Required vs Optional clearly separated, every variable documented
- `GET /health` now reports Postgres/Redis/queue connectivity and AI/Slack configuration status,
  instead of a bare `{"status":"ok"}`
- [docs/demo/demo-script.md](docs/demo/demo-script.md) — ~2-minute manual walkthrough
- Small, necessary touches to make the above possible: `ANTHROPIC_API_KEY`/`SLACK_BOT_TOKEN`
  became optional (the app boots and degrades gracefully without them) and `.env` loading was
  added at the process entry points — none of it touches business rules

## v0.3.0 — Visual Workflow Builder ✅

Full PRD: [docs/prd/v0.3.0-visual-workflow-builder.md](docs/prd/v0.3.0-visual-workflow-builder.md).

- React Flow canvas in `apps/web`: authors the same fixed webhook → AI → destination shape v0.2.0
  hardcoded, now via drag/connect instead of a seed script
- Node palette and per-node config panels (trigger, AI, destination)
- Workflow persistence through the existing Application/Infrastructure layers — no Domain/Engine
  changes required, since the shape stays the one already proven end to end

## v0.4.0 — Multi-Tenant Auth (Basic) ✅

Full PRD: [docs/prd/v0.4.0-multi-tenant-auth.md](docs/prd/v0.4.0-multi-tenant-auth.md).

- Register → Login → Workspace → Dashboard → Protected Workflow → Logout, one user per Workspace
- `User`, `Workspace`, `RefreshToken`, `PasswordHash` Domain entities/value objects; every
  Workflow now belongs to a Workspace
- JWT access tokens (15 min) + rotating opaque refresh tokens (ADR-0003); a real Prisma migration
  (not `db push`) backfills existing rows into a legacy workspace (ADR-0004)
- CORS becomes an explicit `WEB_ORIGIN` allow-list with credentials, replacing `origin: true`
- Every route authenticated; `apps/web` gets login/register pages and gates the editor

## v0.5.0 — Multi-Provider AI ✅

Full PRD: [docs/prd/v0.5.0-multi-provider-ai.md](docs/prd/v0.5.0-multi-provider-ai.md). Decision
record: [docs/adr/0005-provider-selection-strategy.md](docs/adr/0005-provider-selection-strategy.md).

- Real `OpenAIProvider` (`packages/ai/openai`) and `GeminiProvider` (`packages/ai/gemini`)
  adapters, replacing the `Not implemented` stubs, using the official `openai` and
  `@google/generative-ai` SDKs
- New `@flowmind/ai-mock` package: a deterministic `MockAIProvider`, substituted by the
  composition root — never by the Engine, never selectable from a workflow — whenever a
  provider's API key is absent at boot, so `pnpm demo` succeeds end to end with zero AI keys
- No new selection abstraction: per-step provider choice already worked via
  `AIStepConfig.provider` + `AIExecutor`'s injected resolver (confirmed with a multi-provider
  Engine test), extended rather than replaced
- `apps/web`'s AI node dropdown gains OpenAI/Gemini options (no Mock option, ever)

## v0.6.0 — Scheduling ✅

Full PRD: [docs/prd/v0.6.0-scheduling.md](docs/prd/v0.6.0-scheduling.md). Decision record:
[docs/adr/0006-schedule-execution-strategy.md](docs/adr/0006-schedule-execution-strategy.md).

- New `Schedule` Domain entity (UTC-only cron expression, structurally validated with no new
  Domain dependency) plus `CreateSchedule`/`ListSchedules`/`DeleteSchedule` Application use cases
- `PrismaScheduleRepository` and `BullMQScheduleQueue` — the latter wraps the exact same
  `workflow-execution` Queue instance webhook enqueues already use, registering recurring jobs via
  BullMQ's Job Scheduler API (`upsertJobScheduler`/`removeJobScheduler`), never the deprecated
  `repeat` option
- Ordering-plus-compensation consistency strategy for the Postgres/BullMQ dual-write (no saga
  framework, no status column, no reconciliation job) — see ADR-0006
- Hard 20-schedules-per-workspace limit enforced in Application; cross-tenant access reads as 404,
  matching the existing Workflow/WorkflowRun pattern
- `POST`/`GET`/`DELETE /schedules` plus a minimal frontend panel scoped to the currently-open
  Workflow, with a UTC-only disclaimer and no timezone picker
- Zero changes to `packages/engine`; the Worker gains at most one unused optional field's type

## Future (unscheduled, directional only)

- Timezone support for Schedules (deferred by ADR-0006 — BullMQ's `RepeatOptions.tz` already
  supports this without a storage migration)
- Pausing/resuming a Schedule without deleting it
- Automatic runtime fallback between AI providers (explicitly deferred by ADR-0005)
- Billing and subscription management
- Marketplace of third-party/community node types

These are known future directions, not commitments with dates.
