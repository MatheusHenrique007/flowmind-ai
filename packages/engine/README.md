# @flowmind/engine

Runs a `Workflow`'s steps strictly sequentially through a `StepExecutorRegistry`. Depends only on
`@flowmind/domain`, `@flowmind/application` (port types), `@flowmind/ai-contracts`, and
`@flowmind/destinations-contracts` — never on a vendor SDK or infra framework. See ADR-0002.
