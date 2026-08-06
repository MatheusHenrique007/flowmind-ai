# Tech Stack

**The stack below is frozen for the current phase of the project.** It was chosen deliberately
and is not up for casual debate. Personal preference alone ("I'd rather use X") is never a
sufficient reason to change it. Changes require a proposal following the template below,
reviewed and accepted the same way an ADR would be.

## Frontend

- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS
- React Flow (visual workflow editor canvas)
- TanStack Query (server state)
- Zustand (client/UI state)
- React Hook Form + Zod (forms and validation)
- Playwright (e2e tests)

## Backend

- Node.js, TypeScript
- Fastify (HTTP server)
- Prisma + PostgreSQL (persistence)
- Redis + BullMQ (queues/background jobs)
- Zod (validation)
- JWT (access + refresh tokens)
- OpenAPI/Swagger (API documentation)
- Vitest (unit/integration tests)

## AI

- Multi-provider: OpenAI, Anthropic Claude, Google Gemini
- Abstracted behind a provider-agnostic port (`packages/ai/contracts`) with a factory
  (`packages/ai/factory`) and one adapter package per provider

## Infrastructure

- Docker / Docker Compose (local Postgres, Redis)
- pnpm workspaces + Turborepo (monorepo tooling)
- GitHub Actions (CI/CD)

## Quality

- ESLint 9 (flat config), Prettier
- Husky, lint-staged, commitlint (Conventional Commits)
- Vitest (unit), Playwright (e2e)

## Architecture

- Clean Architecture (Domain / Application / Infrastructure / Presentation)
- Manual dependency injection — no DI framework, no decorators

---

## Proposing a stack change

If a stack change is genuinely warranted (not preference-driven), open a PR adding a document
under `docs/architecture/proposals/` using this template:

```markdown
# Stack Change Proposal: <short title>

## Problem

What concrete problem does the current stack cause? Cite evidence (an incident, a measured
limitation, a blocked requirement) — not "I don't like it" or "X is more popular now".

## Proposed Solution

The specific change: what's added, replaced, or removed, and why this option over alternatives.

## Trade-offs

What we gain and what we give up. Be honest about downsides (learning curve, ecosystem
maturity, migration risk, maintenance burden).

## Impact on Completed Releases

What already-shipped code/features would need to change, and how much rework that implies.

## Migration Cost

Concrete estimate: effort, risk, and a rollback plan if the migration stalls or fails.
```

A proposal is only actionable once it has been reviewed and explicitly accepted.
