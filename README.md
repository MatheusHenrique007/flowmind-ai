<div align="center">

<!-- TODO: replace with a real logo (docs/assets/logo.png) -->

# 🧠 FlowMind AI

**AI-powered workflow automation — webhook in, Claude in the middle, Slack out.**

[![CI](https://github.com/MatheusHenrique007/flowmind-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/MatheusHenrique007/flowmind-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-workspaces-F69220?logo=pnpm&logoColor=white)](pnpm-workspace.yaml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Current Version**: v0.2.1 · **Status**: Execution Engine, Product Polish · **Next**: v0.3.0

</div>

---

FlowMind AI is a B2B SaaS workflow automation platform, in the spirit of Zapier or n8n: users
compose triggers, AI steps, and integrations into automated workflows. **v0.1.0** built the
monorepo foundation; **v0.2.0** proved the execution engine end to end with one hardcoded
workflow; **v0.2.1** (this release) turns that technical MVP into something you can clone,
configure, and demo in under 10 minutes.

No visual editor yet — see [Roadmap](#roadmap) for what's next.

## Key features (v0.2.1)

- **Webhook → AI → Slack**, wired end to end: a `POST` request triggers a BullMQ job, a Worker
  runs the Engine, Claude summarizes the input, Slack gets notified.
- **Full run history**: every execution is persisted with per-step status, timing, and errors —
  queryable via `GET /workflow-runs`.
- **Dependency health check**: `GET /health` reports Postgres, Redis, the queue, and whether AI/
  Slack credentials are even configured — before you go looking for why something failed.
- **One-command demo**: `pnpm demo` brings up dependencies, seeds data, boots the API, fires the
  webhook, and prints the result — no manual steps, no manual SQL.
- **Clean Architecture, strictly enforced**: Domain and Application layers have zero
  infrastructure imports — verified by a dedicated ESLint rule, not just a comment.

## Architecture

Clean Architecture, manual dependency injection (no DI framework, no decorators) — full write-up
in [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md).

```
User
  │
  ▼
Webhook  ──POST /webhooks/:workflowId──▶  Fastify API
                                              │  enqueues only
                                              ▼
                                            Queue (BullMQ / Redis)
                                              │
                                              ▼
                                            Worker  ──▶  ExecuteWorkflow (Application)
                                                              │
                                                              ▼
                                                          Engine (packages/engine)
                                                              │  Trigger → AI → Destination
                                                              ▼
                                                          Claude  →  Slack
                                                              │
                                                              ▼
                                                          PostgreSQL (run history)
```

- **Domain** (`packages/domain`) — `Workflow`/`WorkflowRun`/`WorkflowStep`, zero external deps.
- **Application** (`packages/application`) — use cases (`ExecuteWorkflow`, `GetWorkflowRun`,
  `ListWorkflowRuns`) and the ports Infrastructure implements. Depends only on Domain.
- **Engine** (`packages/engine`) — runs a Workflow's steps sequentially through a
  `StepExecutorRegistry`; knows only the `AIProvider`/`Destination` contracts, never Claude or
  Slack directly.
- **Infrastructure** — Prisma repositories, `ClaudeProvider`, `SlackDestination`, the BullMQ
  queue/worker. Implements Application's ports.
- **Presentation** (`apps/api`) — Fastify routes and the composition root that wires everything.

## Monorepo structure

```
flowmind-ai/
├── apps/
│   ├── api/                     # Fastify HTTP API (Presentation) + composition root
│   └── web/                     # Next.js frontend (Presentation) — placeholder until v0.3+
├── packages/
│   ├── domain/                  # @flowmind/domain
│   ├── application/             # @flowmind/application
│   ├── engine/                  # @flowmind/engine
│   ├── infrastructure/          # @flowmind/infrastructure (Prisma, BullMQ, health check)
│   ├── ai/
│   │   ├── contracts/           # @flowmind/ai-contracts (AIProvider port)
│   │   ├── factory/             # @flowmind/ai-factory
│   │   ├── claude/              # @flowmind/ai-claude — real (@anthropic-ai/sdk)
│   │   ├── openai/               # @flowmind/ai-openai — stub, not wired yet
│   │   └── gemini/               # @flowmind/ai-gemini — stub, not wired yet
│   └── destinations/
│       ├── contracts/           # @flowmind/destinations-contracts (Destination port)
│       └── slack/                # @flowmind/destinations-slack — real (fetch, no SDK)
├── docs/
│   ├── architecture/            # ARCHITECTURE.md, tech-stack.md
│   ├── adr/                     # Architecture Decision Records
│   ├── prd/                     # Product Requirements Docs per release
│   └── demo/                    # demo-script.md
├── scripts/
│   └── demo.mjs                 # `pnpm demo`
└── docker-compose.yml            # Postgres + Redis
```

## Tech stack

**Backend**: Node.js, TypeScript, Fastify, Prisma + PostgreSQL, Redis + BullMQ, Zod, Anthropic
SDK. **Frontend**: Next.js 15, React 19, Tailwind, React Flow, TanStack Query, Zustand (scaffolded,
not the focus of this release). **Infra**: Docker Compose, pnpm workspaces + Turborepo, GitHub
Actions. **Quality**: Vitest, Playwright, ESLint 9, Prettier, Husky.

Frozen as the official stack — see [ADR-0001](docs/adr/0001-foundation-decisions.md). Full list:
[docs/architecture/tech-stack.md](docs/architecture/tech-stack.md).

## Installation

Requires Node.js ≥20, pnpm ≥9, and Docker (for Postgres/Redis).

```bash
git clone https://github.com/MatheusHenrique007/flowmind-ai.git
cd flowmind-ai
pnpm install
```

## Configuring `.env`

```bash
cp .env.example .env
```

`.env.example` documents every variable and separates **required** (`DATABASE_URL`, `REDIS_URL`
— the app won't boot without these; the defaults already match `docker-compose.yml`) from
**optional** (`ANTHROPIC_API_KEY`, `SLACK_BOT_TOKEN`, `SLACK_CHANNEL` — the app boots without
them, `GET /health` reports them as `not_configured`, and the matching workflow step fails with a
clear error instead of crashing).

## Running locally

```bash
docker compose up -d   # Postgres + Redis
pnpm seed               # creates the demo workflow
pnpm --filter @flowmind/api dev
```

```bash
curl http://localhost:3001/health
```

## Run the demo

```bash
pnpm demo
```

This single command validates your environment, starts Postgres/Redis, seeds the demo workflow,
boots the API, fires the webhook, and prints each step's result — including a clear error message
if `ANTHROPIC_API_KEY`/`SLACK_BOT_TOKEN` aren't set, rather than a crash. For the manual,
narratable version (useful for recording a video), see
[docs/demo/demo-script.md](docs/demo/demo-script.md).

## Screenshots

<!-- TODO: add real screenshots once the visual editor (v0.3+) exists -->

_No UI yet — this release is API + Worker only. Screenshots land once the visual editor ships._

## Demo GIF

<!-- TODO: record a ~2-minute terminal recording of `pnpm demo` and embed it here -->

## Roadmap

- **v0.1.0** — Monorepo foundation, tooling, CI ✅
- **v0.2.0** — Execution engine proven end to end (Webhook → Claude → Slack) ✅
- **v0.2.1** — Product polish: README, demo command, health check, seed script (this release) ✅
- **v0.3.0** — Additional triggers/providers/destinations, building on the same contracts
- **Future** — Visual workflow editor, multi-tenant auth, billing, node marketplace

Full detail: [ROADMAP.md](ROADMAP.md).

## Definition of Done — Release v0.1.0

- [x] Monorepo created
- [x] GitHub configured (templates, CODEOWNERS, branch protection on `main`)
- [x] CI green (lint, typecheck, test, build, e2e) — all 5 checks passing on
      [PR #1](https://github.com/MatheusHenrique007/flowmind-ai/pull/1), merged into `main`
- [x] Docker Compose brings up PostgreSQL and Redis — verified during v0.2.0 once Docker Desktop's
      backend was fixed: `docker compose up -d` starts both containers, Prisma migrations and the
      full webhook → Slack pipeline ran against them for real
- [x] API starts correctly (`/health` responds) — verified locally
- [x] Web starts correctly (landing page renders) — verified locally
- [x] Lint/typecheck/test/build green
- [x] Husky/commitlint working, first push to `main` completed

## Definition of Done — Release v0.2.0

- [x] Domain layer (Workflow/WorkflowRun/WorkflowStep/ExecutionContext) — 37 unit tests
- [x] Application layer (ExecuteWorkflow, GetWorkflowRun, ListWorkflowRuns + ports) — 11 unit tests
- [x] Engine (StepExecutorRegistry + 3 executors, sequential, Clock-timestamped) — 16 unit tests
- [x] Infrastructure: Prisma repositories, ClaudeProvider, SlackDestination, BullMQ queue/worker,
      Fastify routes, composition root
- [x] Prisma integration tests run for real against Postgres (locally and in CI)
- [x] Smoke Test: booted `apps/api` against real Postgres + Redis, fired the webhook, watched
      Trigger succeed, AI call the real Anthropic API and fail on an intentionally fake key, run
      correctly recorded `FAILED`, stopped before the Destination step
- [x] Lint/typecheck/test/build green across all 22 packages/apps

## Definition of Done — Release v0.2.1

- [x] Professional README (this file)
- [x] `pnpm demo` — validates env, starts dependencies, seeds, runs the flow, reports the result
- [x] `pnpm seed` — populates the demo workflow, no manual SQL ever required
- [x] `.env.example` documents every variable, Required vs Optional clearly separated
- [x] `GET /health` reports Postgres/Redis/queue connectivity and AI/Slack configuration status
- [x] [docs/demo/demo-script.md](docs/demo/demo-script.md) — ~2-minute manual walkthrough
- [x] Architecture diagram (this file + ARCHITECTURE.md)
- [x] Lint/typecheck/test/build green — no changes to Domain/Application/Engine business logic;
      Infrastructure/Presentation touched only for the health check and dotenv loading (see PR
      description for the full list and the real bugs this release's manual testing caught)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching strategy, commit conventions, and the
local checks to run before opening a PR.

## License

[MIT](LICENSE)
