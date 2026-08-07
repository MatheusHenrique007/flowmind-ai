# Architecture

FlowMind AI follows **Clean Architecture** with **manual dependency injection** — no DI
framework, no decorators, no reflection-based magic. Dependencies are wired explicitly at the
composition root (`apps/api/src/composition-root.ts`) by constructing objects and passing them
in through constructors/functions.

## Layers

```
┌─────────────────────────────────────────────┐
│                Presentation                  │  apps/api, apps/web
│   (HTTP routes, controllers, React UI)       │
└───────────────────┬───────────────────────────┘
                    │ depends on
┌───────────────────▼───────────────────────────┐
│                Infrastructure                │  packages/infrastructure,
│  (Prisma repos, Redis/BullMQ, AI adapters)   │  packages/ai/{openai,claude,gemini}
└───────────────────┬───────────────────────────┘
                    │ implements ports from
┌───────────────────▼───────────────────────────┐
│                 Application                  │  packages/application
│      (use cases, ports/interfaces)           │
└───────────────────┬───────────────────────────┘
                    │ depends on
┌───────────────────▼───────────────────────────┐
│                   Domain                     │  packages/domain
│   (entities, value objects, domain events)   │
└─────────────────────────────────────────────────┘
```

### Dependency direction rule

**Inner layers never depend on outer layers.** Domain depends on nothing. Application depends
only on Domain. Infrastructure depends on Application and Domain (it implements Application's
ports). Presentation depends on Application (via use cases) and, transitively, Domain — it
never reaches into Infrastructure's concrete implementations directly; those are wired in at
the composition root.

## Package/app to layer mapping

| Layer          | Package(s) / app(s)                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domain         | `packages/domain` (`@flowmind/domain`)                                                                                                                       |
| Application    | `packages/application` (`@flowmind/application`)                                                                                                             |
| Engine         | `packages/engine` (`@flowmind/engine`) — depends on Domain + Application (port types) + the AI/Destination contracts only, never a vendor SDK. See ADR-0002. |
| Infrastructure | `packages/infrastructure`, `packages/ai/{openai,claude,gemini}`, `packages/destinations/{contracts,slack}`                                                   |
| Presentation   | `apps/api` (`@flowmind/api`), `apps/web` (`@flowmind/web`)                                                                                                   |
| Cross-cutting  | `packages/shared`, `packages/ai/contracts` + `packages/ai/factory` (AI port/factory), `packages/destinations/contracts` (Destination port)                   |

## Runtime execution flow (v0.2.0)

The one hardcoded workflow this release proves, from an inbound webhook to a Slack message and a
queryable record in Postgres:

```
User
  │
  ▼
Webhook  ──POST /webhooks/:workflowId──▶  Fastify (apps/api)
                                              │  enqueues only — never calls ExecuteWorkflow
                                              │  or the Engine directly
                                              ▼
                                            Queue (BullMQ / Redis)
                                              │
                                              ▼
                                            Worker (apps/api, same composition root)
                                              │  calls ExecuteWorkflow only
                                              ▼
                                            Engine (packages/engine)
                                              │  StepExecutorRegistry resolves each step
                                              │  in sequence — Trigger, then AI, then Destination
                                              ▼
                                            Claude  (ClaudeProvider via the AIProvider port)
                                              │  result written to ExecutionContext
                                              ▼
                                            Slack  (SlackDestination via the Destination port)
                                              │
                                              ▼
                                            PostgreSQL (WorkflowRun + WorkflowStepResult,
                                                         via PrismaWorkflowRunRepository)
```

Every arrow after "Worker" only ever touches a port/contract at the call site — the concrete
`ClaudeProvider`/`SlackDestination`/`PrismaWorkflowRunRepository` instances are wired once, at
the composition root (`apps/api/src/composition-root.ts`), and nowhere else.

## The AIProvider port pattern

`packages/ai/contracts` defines a single interface, `AIProvider`, plus provider-agnostic
`AIRequest`/`AIResponse` types. `packages/ai/factory` resolves a concrete `AIProvider` by name.
Each of `packages/ai/openai`, `packages/ai/claude`, and `packages/ai/gemini` implements
`AIProvider` by wrapping that provider's SDK.

Why this exists: FlowMind AI's core value proposition is letting a workflow call _any_ of
several AI providers interchangeably. If Application/Domain code called `openai`'s or
`anthropic`'s SDK directly, every use case would be coupled to a specific vendor's request/
response shape, and adding or swapping a provider would mean touching business logic. By
depending only on the `AIProvider` port:

- Application code (use cases) is 100% provider-agnostic.
- New providers are added by writing a new adapter package — nothing else changes.
- Providers can be swapped per-workflow, per-tenant, or with fallback logic, purely at the
  composition root / factory level.

This is the same dependency-inversion principle applied to Infrastructure at large, scoped
specifically to the AI subsystem because multi-provider support is a first-class product
requirement.
