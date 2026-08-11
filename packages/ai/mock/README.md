# @flowmind/ai-mock

Deterministic `AIProvider` adapter used only as a resolver-level substitute
when a real provider's API key is absent at boot (see
docs/adr/0005-provider-selection-strategy.md). Never throws, never calls a
network. Not a Domain `Provider` value — a workflow can never declare
`provider: "MOCK"`.
