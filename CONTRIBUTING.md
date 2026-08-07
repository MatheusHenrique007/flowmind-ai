# Contributing to FlowMind AI

## Foundation freeze

As of v0.1.0, infrastructure, stack, monorepo layout, CI, and architecture are **frozen**.
Changing any of them requires one of exactly three justifications:

- a critical bug
- a security vulnerability
- a very large, clearly demonstrated technical gain

"I'd rather use X" is never sufficient — see the stack-change proposal template in
[docs/architecture/tech-stack.md](docs/architecture/tech-stack.md). No swapping Prisma, adding
Kafka, migrating to Nest, or similar, without going through that process first.

## Product first

Product drives architecture, never the reverse: Product → Product → Product → architecture only
when the product genuinely needs it → Product → Product. Don't add layers, patterns, or
abstractions ahead of a real product requirement.

Starting v0.2.0, every new feature must answer one question before it's built: **"will this be
used in FlowMind's official demo?"** If the honest answer is no, it doesn't go in yet — no
complex settings, billing, marketplace, multi-tenant org/teams, or advanced RBAC until the core
product itself is proven.

## Releases, not sprints

Work ships as **Releases** (`v0.1.0`, `v0.2.0`, ...) — see [ROADMAP.md](ROADMAP.md). Every
release must satisfy these rules before it's considered closed:

- **Demo rule**: if the release can't be demoed in under two minutes, it was scoped too large.
- **Recruiter rule**: ask "would a Tech Lead opening this repo today be impressed?" If not, the
  release isn't done.
- **No technical debt carryover**: a release must never leave the codebase with more debt than
  it started with. If a release genuinely creates debt (a deliberate shortcut, a known gap), the
  very next release must pay it down — it cannot be pushed further down the roadmap.
- **Honesty rule**: never say a Release "works" without having verified it. Document
  limitations explicitly (as in v0.1.0's Docker Compose gap) rather than hiding them.

## Branch strategy

We use trunk-based development against `main`:

- `main` is always deployable.
- Create short-lived branches named `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, or
  `docs/<slug>`.
- Open a pull request into `main`. Squash-merge once CI is green and the PR is approved.
- Avoid long-lived feature branches; prefer small, incremental PRs.

## Commit messages

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/), enforced
by commitlint via a Husky `commit-msg` hook.

```
feat(api): add health check endpoint
fix(web): correct tailwind config content globs
chore(deps): bump fastify to 5.0.0
docs(readme): document getting started steps
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`.

## Local checks before opening a PR

Run the following from the repo root and make sure they all pass — CI runs the same commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For frontend changes, also run the Playwright suite:

```bash
pnpm --filter @flowmind/web test:e2e
```

## Release validation pipeline

Starting with v0.2.0, closing a release requires two more steps after lint/typecheck/test/build,
run manually (not yet automated in CI):

```
lint → typecheck → test → build → Smoke Test → Demo Test
```

**Smoke Test** — confirm every runtime piece the release touches actually starts and connects:
does the API start, does the web app start, does the worker start (once one exists), does Redis
connect, does Postgres connect. A green CI build proves the code compiles and unit tests pass —
it does not prove the system boots.

**Demo Test** — before closing, answer: "could I record a 2-minute video showing this release
working end to end?" If not, the release isn't done — either finish it or cut scope until the
answer is yes.

## Architecture Decision Records (ADRs)

We keep ADRs in [docs/adr](docs/adr). Write an ADR only for decisions that are architecturally
significant — introducing a new layer, changing the frozen stack, adopting a new cross-cutting
pattern. Do not write an ADR for routine implementation choices, naming, or anything easily
reversible. See [docs/architecture/tech-stack.md](docs/architecture/tech-stack.md) for the
required template when a stack change is proposed.
