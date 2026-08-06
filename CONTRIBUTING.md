# Contributing to FlowMind AI

## Product first

Product drives architecture, never the reverse: Product → Product → Product → architecture only
when the product genuinely needs it → Product → Product. Don't add layers, patterns, or
abstractions ahead of a real product requirement.

## Releases, not sprints

Work ships as **Releases** (`v0.1.0`, `v0.2.0`, ...) — see [ROADMAP.md](ROADMAP.md). Every
release must satisfy two rules before it's considered closed:

- **Demo rule**: if the release can't be demoed in under two minutes, it was scoped too large.
- **Recruiter rule**: ask "would a Tech Lead opening this repo today be impressed?" If not, the
  release isn't done.

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
pnpm --filter web test:e2e
```

## Architecture Decision Records (ADRs)

We keep ADRs in [docs/adr](docs/adr). Write an ADR only for decisions that are architecturally
significant — introducing a new layer, changing the frozen stack, adopting a new cross-cutting
pattern. Do not write an ADR for routine implementation choices, naming, or anything easily
reversible. See [docs/architecture/tech-stack.md](docs/architecture/tech-stack.md) for the
required template when a stack change is proposed.
