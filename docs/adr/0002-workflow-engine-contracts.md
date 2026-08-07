# 0002 — Workflow Engine Isolated Behind AIProvider and Destination Contracts

- **Status**: Accepted
- **Date**: 2026-08-07

## Context

Release v0.2.0 introduces the first real Workflow Engine: it runs a sequence of steps (trigger →
AI step → destination step) for one hardcoded workflow (webhook → Claude → Slack). Even though
only one AI provider and one destination exist today, the Engine is the piece of the codebase
every future trigger, provider, and destination will run through. If the Engine's step-execution
logic references `ClaudeProvider` or `SlackDestination` by name, every new provider or
destination requires touching the Engine itself — exactly the coupling ADR-0001 Decision 3
already rejected for AI providers, and the same risk now applies to destinations and to how
steps hand off to each other.

## Decision

Three rules govern the Engine from this release onward:

1. **The Engine depends only on contracts, never on concrete adapters.** It knows `AIProvider`
   (`packages/ai/contracts`, per ADR-0001) and a new `Destination` contract
   (`packages/destinations/contracts`) — never `ClaudeProvider` or `SlackDestination` directly.
   `packages/destinations/slack` is the first (and, this release, only) adapter; a
   `packages/destinations/factory` package resolves a `Destination` by name, mirroring
   `ai-factory`.
2. **Steps never call each other directly.** A step reads from and writes to a shared, in-memory
   `ExecutionContext` object; the Engine passes the updated context to the next step. There is no
   `ClaudeNode → SlackNode` call anywhere in the codebase — only `ClaudeNode → ExecutionContext →
SlackNode`.
3. **The Worker executes the Engine; it does not select providers or destinations.** That
   selection is a factory-layer concern (`ai-factory`, `destinations/factory`), invoked by the
   Engine's composition root, not hardcoded into the Worker's job-processing code.

## Consequences

**Positive**

- Adding OpenAI, Gemini, Notion, GitHub, or Discord support later means adding one adapter
  package and registering it with the relevant factory — zero changes to the Engine or the
  Worker.
- Steps are independently testable against a fake `ExecutionContext`, without needing a real
  Claude API key or a real Slack webhook.
- The Engine's execution logic (sequencing, error handling, persistence of `WorkflowStep`
  records) is provable once and stays correct as adapters are added.

**Negative / trade-offs**

- More upfront structure than hardcoding `claude.complete() → slack.post()` inline for a
  single-workflow release — accepted because the Engine, unlike the rest of v0.2.0's
  deliberately narrow scope, is exactly the part of the codebase every later release depends on.
- `ExecutionContext`'s shape is a shared, evolving contract across all step types; adding a
  fundamentally new kind of step data later may require extending it carefully, same trade-off
  already accepted for `AIRequest`/`AIResponse` in ADR-0001.

## Alternatives considered

- **Call `claude.complete()` and `slack.post()` directly from the Engine for this one hardcoded
  workflow, generalize later**: rejected. "Generalize later" on the Engine specifically has a
  poor track record in workflow-automation systems — the Engine is the piece every future
  trigger/provider/destination flows through, and retrofitting contracts onto an Engine already
  built around two concrete SDKs is far more expensive than building it against contracts once,
  correctly, from the start.
- **Pass concrete provider/destination instances into the Worker directly (constructor
  injection without a factory)**: considered, but a factory keyed by name is what lets a future
  workflow definition (e.g. `{ destination: "discord" }`) resolve to a concrete adapter without
  the Worker or Engine branching on type.

## Implementation note (added v0.2.2)

Rules 1–3 above held exactly as decided. What changed is _how_ provider/destination selection is
implemented: `packages/ai/factory` and a `packages/destinations/factory` package were planned but
never wired — the rejected alternative above ("constructor injection without a factory") is what
actually shipped. `AIExecutor`/`DestinationExecutor` take an injected resolver function
(`(name) => AIProvider | undefined`), and the composition root
(`apps/api/src/composition-root.ts`) passes `() => claudeProvider` / `() => slackDestination`
directly — there is exactly one provider and one destination in this release, so a name-keyed
factory added indirection with no present benefit. The dependency-inversion rules this ADR exists
to protect (Engine depends only on contracts, never concrete adapters) are unaffected either way.
Revisit the factory approach once a workflow definition actually needs to select a provider/
destination by name at runtime (v0.3+, multiple providers/destinations).
