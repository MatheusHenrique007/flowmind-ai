# Roadmap

FlowMind AI ships as **Releases** (`v0.1.0`, `v0.2.0`, ...), not internal sprints — each entry
below should read like a product milestone a user or a Tech Lead could understand, not an
engineering to-do list. See `docs/adr/0001-foundation-decisions.md` (Decision 6) for why.

Rules that gate every release closing (see [CONTRIBUTING.md](CONTRIBUTING.md) for full detail):

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

## v0.1.0 — Foundation (in progress)

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

## v0.2.0 — Minimal end-to-end execution engine (next)

The foundation is frozen as of this release: no further infrastructure, tooling, or monorepo
reorganization work unless it's a bug fix or a critical correction. 100% of effort goes into
product features that move FlowMind AI toward a usable MVP.

Goal: prove the execution engine works end-to-end with one fixed, hardcoded workflow — no visual
editor yet. Demoable in under two minutes: trigger the fixed workflow, watch it run, see the
Slack message land.

- Fixed workflow: **Email trigger → AI summarize → Slack notification**
- Domain model for a minimal workflow/run/step
- Application use case to execute that single workflow
- Infrastructure adapters: email trigger listener, one AI provider wired through `ai-factory`
  (only that one provider's SDK gets installed), Slack notification sender
- Just enough persistence (Prisma installed and wired here, not before) to record a workflow run
  and its steps
- Tests covering the execution path

## Future (unscheduled, directional only)

- Visual workflow editor (React Flow canvas, node palette, drag/connect)
- Multi-tenant authentication and authorization
- Billing and subscription management
- Marketplace of third-party/community node types

These are known future directions, not commitments with dates.
