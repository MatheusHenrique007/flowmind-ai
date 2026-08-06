# 0001 — Foundation Decisions

- **Status**: Accepted
- **Date**: 2026-08-06

## Context

Before any product code was written, several foundational decisions had to be locked so every
later Release builds on the same ground rules instead of re-litigating them. This ADR captures
those decisions together, since they were all made as one package during Release 0.1
(foundation) and are meant to be read as a single starting point for the project.

## Decisions

### 1. Tech stack is frozen

Frontend (Next.js App Router, React, TypeScript, Tailwind, React Flow, TanStack Query, Zustand,
React Hook Form, Zod), backend (Node.js, TypeScript, Fastify, Prisma, PostgreSQL, Redis, BullMQ,
JWT + refresh tokens, OpenAPI/Swagger), AI (OpenAI, Anthropic, Gemini behind a provider-agnostic
port — see Decision 3), infrastructure (Docker, Docker Compose, Turborepo, pnpm workspaces,
GitHub Actions), and quality tooling (Vitest, Playwright, ESLint, Prettier, Husky, lint-staged,
EditorConfig) are the official stack. Full list and rationale: `docs/architecture/tech-stack.md`.

Personal preference alone never justifies changing an entry in this list. A change requires a
written proposal with Problem, Proposed Solution, Trade-offs, Impact on Completed Releases, and
Migration Cost (template in `tech-stack.md`).

**Why**: stack-hopping (Prisma this week, Drizzle next week, TypeORM the week after) is a common
way portfolio-grade projects never ship. Freezing the stack up front forces effort into the
product instead of tooling debates.

### 2. Clean Architecture with manual dependency injection

Four layers: `packages/domain` (depends on nothing), `packages/application` (depends only on
Domain), `packages/infrastructure` (implements Application's ports), and Presentation
(`apps/api`, `apps/web`, composing everything at a single composition root per app). No DI
framework, no decorators, no reflection-based container — dependencies are constructed
explicitly and passed in.

**Alternatives considered**: a NestJS-style container-based DI was rejected — it couples
business logic to framework decorators and module wiring, and hides the dependency graph behind
container resolution, which conflicts with the goal of business logic that stays unit-testable
without booting any framework. A "fat routes, no layering" approach was rejected outright as
unfit for a production SaaS expected to grow multiple integrations, AI providers, and background
job types.

**Trade-off accepted**: more boilerplate at each composition root as use cases grow, since
there's no container to generate the wiring — judged worth it for explicitness and testability.

### 3. Multi-provider AI abstracted behind a contracts/factory port

`packages/ai/contracts` (`@flowmind/ai-contracts`) defines the provider-agnostic `AIProvider`
interface and `AIRequest`/`AIResponse`/`AIMessage` types, with zero dependency on any vendor SDK.
`packages/ai/factory` resolves a concrete provider by name. `packages/ai/openai`,
`packages/ai/claude`, `packages/ai/gemini` each implement `AIProvider` by wrapping their vendor
SDK. Application use cases depend only on the `AIProvider` interface, never on a vendor SDK or on
the factory directly.

**Alternatives considered**: calling vendor SDKs directly from use cases was rejected — multi-
provider support is a core product requirement, and direct calls would force every provider
change to touch business logic. A third-party "universal AI SDK" wrapping multiple providers was
considered and rejected for now — it would add a critical-path dependency with its own
abstraction leaks and release cadence, for something central enough to the product to warrant
owning the contract shape in-house.

**Trade-off accepted**: the shared request/response contract is a lowest-common-denominator
shape; provider-specific capabilities need careful, deliberate extension rather than day-one
parity. One extra layer of indirection (contracts → factory → adapter) to trace through when
debugging an AI call.

### 4. Trunk-based development

`main` is the only long-lived branch, protected, merged only via pull request. Work happens on
short-lived `feat/`, `fix/`, `chore/`, `docs/` branches. No `develop` branch — it would add
overhead with no benefit at this project's size.

### 5. Conventional Commits, enforced

All commits follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`), enforced by commitlint via a
Husky `commit-msg` hook. This keeps history greppable and unlocks automated changelogs later
without extra tooling adopted up front.

### 6. Releases, not Sprints — and a Definition of Done per release

Work is tracked as shippable **Releases** (`v0.1.0`, `v0.2.0`, ...), not internal "sprints" —
each one should read like a product milestone (e.g. "v0.1.0 — foundation ready", not "Sprint 0
done"). Two rules apply to every release:

- **Demo rule**: a release isn't done until its result can be demoed in under two minutes. If it
  can't, the release was scoped too large.
- **Recruiter rule**: before closing a release, ask "would a Tech Lead opening this repo today be
  impressed?" If the honest answer is no, the release isn't done yet.

Product drives architecture, not the other way around — architecture exists to serve a shippable
release, never as an end in itself.

## Consequences

Positive and negative consequences of decisions 2 and 3 are detailed inline above. Collectively,
these six decisions mean: no time is spent re-debating stack, layering, AI integration strategy,
branching, or commit style in any later release — that time goes to the product instead.

## Alternatives considered

See each decision above for the alternatives considered specific to it.
