# FlowMind AI

**Current Version**: v0.2.0 (in progress)
**Status**: Execution Engine
**Next**: v0.3.0 — additional triggers/providers/destinations

FlowMind AI is an AI-powered workflow automation platform (B2B SaaS) in the spirit of Zapier or
n8n: users compose triggers, AI steps, and integrations into automated workflows through a
visual editor. **v0.1.0** laid down the monorepo foundation, tooling, and CI. **v0.2.0** proves
the core mechanic end to end with one hardcoded workflow — see
[docs/prd/v0.2.0-execution-engine.md](docs/prd/v0.2.0-execution-engine.md).

As of v0.2.0, the foundation is frozen: no further infrastructure, tooling, or monorepo
reorganization work unless it's a bug fix or a critical correction. All effort goes into product
features that move FlowMind AI toward a usable MVP.

## Tech stack

**Frontend**

- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS
- React Flow (visual workflow editor)
- TanStack Query, Zustand
- React Hook Form + Zod

**Backend**

- Node.js, TypeScript, Fastify
- Prisma + PostgreSQL
- Redis + BullMQ (background jobs/queues)
- Zod (validation)
- JWT (access + refresh tokens)
- OpenAPI/Swagger

Frozen as the official stack (see [ADR-0001](docs/adr/0001-foundation-decisions.md)). As of
v0.2.0, Prisma and BullMQ are wired for real; OpenAI/Gemini adapters remain stubs until a later
release actually needs them (per the same "install only what's wired" rule).

**AI**

- Multi-provider abstraction: OpenAI, Anthropic Claude, Google Gemini
- Provider-agnostic `AIProvider` port with a factory for provider selection. `ClaudeProvider` is
  real (`@anthropic-ai/sdk`) as of v0.2.0; OpenAI/Gemini adapters stay stubs until wired.

**Infrastructure**

- Docker / Docker Compose (Postgres, Redis)
- pnpm workspaces + Turborepo (monorepo, task orchestration)
- GitHub Actions (CI: lint, typecheck, test, build, e2e)

**Quality**

- Vitest (unit/integration tests)
- Playwright (end-to-end tests)
- ESLint 9 (flat config) + Prettier
- Husky + lint-staged + commitlint (Conventional Commits)

## Architecture

FlowMind AI follows **Clean Architecture** with **manual dependency injection** (no DI
framework, no decorators):

- **Domain** — entities, value objects, domain events. No external dependencies.
- **Application** — use cases and ports, depends only on Domain.
- **Infrastructure** — implements Application ports (Prisma, Redis, BullMQ, AI adapters).
- **Presentation** — HTTP layer (Fastify routes) and the web frontend (Next.js).

See [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) for the full write-up,
including the AI provider port pattern.

## Monorepo structure

```
flowmind-ai/
├── apps/
│   ├── api/                 # Fastify HTTP API (Presentation)
│   └── web/                 # Next.js frontend (Presentation)
├── packages/
│   ├── domain/               # @flowmind/domain
│   ├── application/          # @flowmind/application
│   ├── infrastructure/       # @flowmind/infrastructure
│   ├── shared/                # @flowmind/shared (Zod schemas, shared types)
│   ├── eslint-config/         # @flowmind/eslint-config
│   ├── tsconfig/              # @flowmind/tsconfig
│   └── ai/
│       ├── contracts/         # @flowmind/ai-contracts (AIProvider port)
│       ├── factory/           # @flowmind/ai-factory
│       ├── openai/            # @flowmind/ai-openai
│       ├── claude/            # @flowmind/ai-claude
│       └── gemini/            # @flowmind/ai-gemini
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── prd/
│   ├── api/
│   └── database/
└── docker-compose.yml
```

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Start local infrastructure (Postgres + Redis)
docker compose up -d

# 3. Configure environment
cp .env.example .env
# then fill in the required secrets

# 4. Run everything in dev mode
pnpm dev

# Other useful commands
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Definition of Done — Release v0.1.0

This release is only considered complete once every item below is checked:

- [x] Monorepo created
- [x] GitHub configured (templates, CODEOWNERS, branch protection on `main`)
- [x] CI green (lint, typecheck, test, build, e2e) — all 5 checks passing on
      [PR #1](https://github.com/MatheusHenrique007/flowmind-ai/pull/1), merged into `main`
- [x] Docker Compose brings up PostgreSQL and Redis — verified during v0.2.0 once Docker Desktop's
      backend was fixed: `docker compose up -d` starts both containers, Prisma migrations and the
      full webhook → Slack pipeline ran against them for real
- [x] API starts correctly (`/health` responds) — verified locally: `{"status":"ok"}`
- [x] Web starts correctly (landing page renders) — verified locally
- [x] Lint green — `pnpm lint`, 14/14 packages
- [x] Typecheck green — `pnpm typecheck`, 14/14 packages
- [x] Tests green — `pnpm test`, 14/14 packages
- [x] Build green — `pnpm build`, 11/11 packages
- [x] Husky hooks working — verified on the first real commit
- [x] Commitlint working — verified on the first real commit
- [x] First push to `main` completed

## Definition of Done — Release v0.2.0

- [x] Domain layer (Workflow/WorkflowRun/WorkflowStep/ExecutionContext) — 37 unit tests
- [x] Application layer (ExecuteWorkflow, GetWorkflowRun, ListWorkflowRuns + ports) — 11 unit tests
- [x] Engine (StepExecutorRegistry + 3 executors, sequential, Clock-timestamped) — 16 unit tests
- [x] Infrastructure: Prisma repositories, ClaudeProvider, SlackDestination, BullMQ queue/worker,
      Fastify routes, composition root
- [x] Prisma integration tests run for real against Postgres (locally and in CI — see
      `.github/workflows/ci.yml`'s `test` job)
- [x] Smoke Test (per CONTRIBUTING.md): booted `apps/api` against real Postgres + Redis,
      `POST /webhooks/webhook-to-slack-demo` → queued → Worker executed `ExecuteWorkflow` →
      Trigger step succeeded → AI step called the real Anthropic API and failed on an
      intentionally fake key → run correctly recorded `FAILED`, stopped before the Destination
      step, visible via `GET /workflow-runs`. Proves the full wiring; a real `ANTHROPIC_API_KEY`
      and `SLACK_BOT_TOKEN` are what's needed for the end-to-end Slack demo itself.
- [x] Lint/typecheck/test/build green across all 22 packages/apps

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching strategy, commit conventions, and the
local checks to run before opening a PR.

## License

[MIT](LICENSE)
