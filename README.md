# FlowMind AI

FlowMind AI is an AI-powered workflow automation platform (B2B SaaS) in the spirit of Zapier or
n8n: users compose triggers, AI steps, and integrations into automated workflows through a
visual editor. This repository is the monorepo foundation — **Release v0.1.0** — laying down
tooling, architecture, and CI before any product feature is built.

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

Frozen as the official stack (see [ADR-0001](docs/adr/0001-foundation-decisions.md)); Prisma,
BullMQ, and vendor AI SDKs are only installed in the release that actually wires them up — none
of them are dependencies yet in this foundation release.

**AI**

- Multi-provider abstraction: OpenAI, Anthropic Claude, Google Gemini
- Provider-agnostic `AIProvider` port with a factory for provider selection (contracts and
  adapter stubs exist now; vendor SDKs land when a provider is first wired, in v0.2.0)

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
- [ ] GitHub configured (templates, CODEOWNERS, branch protection)
- [ ] CI green (lint, typecheck, test, build, e2e) — pending first push
- [ ] Docker Compose brings up PostgreSQL and Redis — **not verified**: Docker is not installed
      on this development machine; `docker-compose.yml` exists and is reviewed, but has not been
      run. Flagged here rather than checked off, per this project's honesty rule.
- [x] API starts correctly (`/health` responds) — verified locally: `{"status":"ok"}`
- [x] Web starts correctly (landing page renders) — verified locally
- [x] Lint green — `pnpm lint`, 14/14 packages
- [x] Typecheck green — `pnpm typecheck`, 14/14 packages
- [x] Tests green — `pnpm test`, 14/14 packages
- [x] Build green — `pnpm build`, 11/11 packages
- [x] Husky hooks working — verified on the first real commit
- [x] Commitlint working — verified on the first real commit
- [ ] First push to `main` completed

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching strategy, commit conventions, and the
local checks to run before opening a PR.

## License

[MIT](LICENSE)
