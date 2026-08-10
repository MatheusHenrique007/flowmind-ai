# 0004 — Workspace Isolation at the Repository Boundary, and Adopting Real Prisma Migrations

- **Status**: Proposed (pending v0.4.0 PRD approval)
- **Date**: 2026-08-08

## Context

v0.4.0 introduces the project's first tenant-scoped data (`Workflow` gains an owning Workspace).
Two decisions compound here: how isolation is enforced in code, and how the schema change reaches
a database that — for the first time in this project's history — already has real rows in it
(the seeded demo workflow, anything created while testing v0.3.0's editor).

## Decision

### Isolation enforced at the repository port, not just in routes

`WorkflowRepository.findById` changes signature to `findById(id: WorkflowId, workspaceId:
WorkspaceId): Promise<Workflow | null>`. A workflow that exists but belongs to a different
workspace returns `null` — the same result as a nonexistent id. Application use cases
(`ExecuteWorkflow`, `GetWorkflowRun`, etc.) all require `workspaceId` as a parameter and pass it
straight through; no use case is trusted to remember to filter correctly on its own, and no
Presentation route can accidentally call a use case without a workspace in scope, because the
signature doesn't allow it.

### Adopting `prisma migrate` instead of `prisma db push`, starting with this release

Every prior schema change in this project used `prisma db push` — fine when there was no data
that mattered (early releases, or additive-only JSON columns). Adding a required
`workflows.workspace_id` column to a table with existing rows needs an actual backfill step
(create a default Workspace, assign existing workflows to it, then tighten the column to
`NOT NULL`), which `db push` cannot express — it's a schema-diffing tool, not a migration runner.
This release switches to `prisma migrate dev` for authoring the migration and `prisma migrate
deploy` for applying it in CI/`pnpm demo`, updating every place that referenced `db push`
(`.github/workflows/ci.yml`, `scripts/demo.mjs`, `packages/infrastructure`'s `db:push` script).

## Consequences

**Positive**

- No existing row is silently dropped or corrupted by this or any future schema change.
- Cross-tenant access returns 404, not 403 — a workflow's existence isn't observable by an
  unauthorized workspace, closing an enumeration channel.
- The migration history becomes a real, reviewable artifact (`prisma/migrations/`) instead of an
  implicit, unversioned schema sync — needed now that the project has real user data.

**Negative / trade-offs**

- `prisma migrate` has a steeper local workflow than `db push` (generate a migration file, review
  it, commit it) — accepted because the alternative (continuing with `db push`) cannot safely
  make this exact change at all.
- Every call site that assumed `db push` (CI, `pnpm demo`, the infrastructure package's scripts)
  needs updating in the same release — a real, if mechanical, blast radius flagged here rather
  than discovered mid-implementation.
- Denormalizing `workspace_id` onto `workflow_runs` (in addition to the join through `workflows`)
  is redundant data — accepted as defense in depth against a future join bug leaking cross-tenant
  run data, at the cost of one column that must stay in sync (set once at run creation, never
  updated after).

## Alternatives considered

- **Filter by workspace only in Fastify route handlers**: rejected — trusts every route author to
  remember the check; the repository-boundary approach makes the omission a type error instead of
  a runtime bug.
- **Return 403 for cross-tenant access instead of 404**: rejected — a 403 confirms the resource
  exists, letting an attacker enumerate valid workflow ids across tenants by observing 403 vs 404;
  404 for both "doesn't exist" and "not yours" leaks nothing.
- **Keep using `db push` and manually run a one-off SQL backfill script outside Prisma's
  tracking**: rejected — works once, but leaves the schema change unversioned and unrepeatable in
  CI/fresh environments, the opposite of what this project's existing CI/demo-script discipline
  expects.
- **Skip denormalizing `workspace_id` onto `workflow_runs`**: considered — simpler, and correct as
  long as every query joins through `workflows`. Rejected in favor of the redundant column because
  the cost (one denormalized field) is low and the failure mode it prevents (a missed join
  condition leaking another tenant's run data) is exactly the kind of mistake this release exists
  to make structurally hard to commit.
