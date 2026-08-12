# 0005 — Provider Selection Strategy: Per-Step Config, Boot-Time Mock Substitution

- **Status**: Accepted
- **Date**: 2026-08-11

## Context

Release v0.5.0 adds real `OpenAIProvider` and `GeminiProvider` adapters alongside the existing
`ClaudeProvider`, and needs `pnpm demo` to succeed end-to-end with zero AI provider API keys
configured (see `docs/prd/v0.5.0-multi-provider-ai.md`). Two questions had to be settled before
writing any code:

1. **How does a workflow pick which provider an AI step uses?** This turns out to already be
   answered by earlier releases: `AIStepConfig` (Domain) carries a `provider: Provider` field,
   `Provider` is `CLAUDE | OPENAI | GEMINI`, and `AIExecutor` (`packages/engine`) already calls an
   injected `AIProviderResolver` — `(provider: Provider) => AIProvider | undefined` — with the
   step's own `config.provider`. ADR-0002's v0.2.2 implementation note already documents that the
   composition root builds this resolver directly (no `ai-factory` involved). Nothing about
   per-step selection needed to change.
2. **What happens when a provider's API key is missing?** Before this release, the composition
   root wired exactly one `ClaudeProvider` regardless of key presence, so a missing
   `ANTHROPIC_API_KEY` meant every Claude-configured AI step failed at request time with a
   `StepExecutionError`. That is honest but makes the demo's headline path (webhook → AI → Slack)
   fail on a fresh clone before any credentials are added — undercutting the product's own pitch.

## Decision

1. **Selection stays exactly as it already was: per-step, via `AIStepConfig.provider` and
   `AIExecutor`'s injected `AIProviderResolver`.** No new abstraction is introduced. Multiple
   providers can already coexist in one workflow — one AI step can be `CLAUDE`, another `OPENAI`
   — because the resolver is consulted independently for each step; this is confirmed by an
   Engine-level test (`packages/engine/src/__tests__/workflow-engine.test.ts`) rather than
   asserted without proof.
2. **The composition root (`apps/api/src/composition-root.ts`) remains the only place a concrete
   resolver is built.** It now constructs a `Record<Provider, AIProvider>` once, at process boot:
   for each of `CLAUDE`/`OPENAI`/`GEMINI`, if the matching env var
   (`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`GEMINI_API_KEY`) is non-empty, the real adapter
   (`ClaudeProvider`/`OpenAIProvider`/`GeminiProvider`) is constructed; otherwise a
   `MockAIProvider` (`packages/ai/mock`) is used for that provider. The `AIProviderResolver`
   passed to `AIExecutor` is a lookup into that map — a pure function of the map, built once.
3. **`MockAIProvider` is a resolver-level substitution decided once at boot, never a runtime
   fallback.** It is not consulted when a real provider's `complete()` call fails mid-run — a
   failing Claude/OpenAI/Gemini request still raises `StepExecutionError` exactly as before.
   Whether a given `Provider` resolves to a real adapter or `MockAIProvider` is fixed for the
   lifetime of the process, decided entirely by key presence at startup.
4. **`MOCK` is never added to the Domain `Provider` enum.** `AIStepConfig.provider` stays exactly
   `CLAUDE | OPENAI | GEMINI` — a workflow definition can never request the mock provider
   directly. `MockAIProvider` only appears as a value inside the composition root's resolver map,
   invisible to Domain and Application code, which continue to reason only about the three real
   providers.
5. **`MockAIProvider`'s output is unmistakably synthetic.** Its `complete()` response begins with
   `[MOCK]` and states plainly that no real provider was configured — it does not imitate any real
   model's tone or response shape, so a demo audience or an engineer reading run output can never
   mistake it for a genuine completion.

## Consequences

**Positive**

- `pnpm demo` now reaches `SUCCEEDED` at the AI step with zero AI provider keys configured — a
  fresh clone demonstrates the full webhook → AI → destination pipeline immediately.
- Adding a fourth provider later means adding one adapter package and one `Record` entry in the
  composition root — the pattern established here (real-adapter-or-Mock, decided once at boot)
  extends directly.
- Domain/Application/Engine code is completely unaware Mock exists — no `if (provider === MOCK)`
  branching leaks upward from Infrastructure.

**Negative / trade-offs**

- A production deployment that forgets to set a provider's API key silently gets Mock responses
  for that provider's steps instead of a hard failure. This is the deliberate trade-off — see
  "Alternatives considered" — mitigated by `GET /health`'s existing `anthropic`/`slack`
  configured/not_configured fields (a deploy-time check can assert those before going live) and
  by `MockAIProvider`'s output being impossible to mistake for a real response in logs or a UI.
- Runtime fallback (retry a different provider if the configured one fails) is explicitly not
  provided — a workflow whose configured, keyed provider fails mid-run still fails the step, full
  stop. Adding fallback later is a materially larger feature (retry policy, partial-failure
  semantics) and is out of scope here.

## Alternatives considered

- **Keep failing hard when a key is absent (status quo before this release)**: rejected as the
  sole behavior — it is more "honest" in production but actively undermines the zero-config demo
  that is this project's primary onboarding path (README, `pnpm demo`). Note this behavior is not
  removed, only superseded when a key truly is absent: a _wrong_ key still produces a real
  provider-adapter failure, since Mock substitution is keyed on presence, not validity.
- **Runtime fallback to Mock (or another provider) only after a real call fails)**: rejected.
  This blurs a genuine outage or bad key with an intentional "no key configured" state, makes
  run outcomes non-deterministic across identical configurations, and was explicitly called out
  as out of scope in the approved PRD.
- **A new `ProviderSelector`/`ProviderRegistry` abstraction distinct from `AIProviderResolver`**:
  rejected — `AIExecutor`'s existing injected resolver already does exactly this job; adding a
  parallel abstraction would duplicate ADR-0002's dependency-inversion rule (Engine depends only
  on contracts) for no behavioral gain.
- **Add `MOCK` to the Domain `Provider` enum, selectable by a workflow author**: rejected — it
  would let a production workflow definition deliberately request fake AI output, which is a
  product/trust problem, not an infrastructure one. Mock exists solely to keep local/demo
  environments honest about missing credentials, not as a user-facing choice.
