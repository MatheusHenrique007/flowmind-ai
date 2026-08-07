# @flowmind/destinations-contracts

`Destination` port — the interface every destination adapter (Slack, Discord, Email, ...)
implements. Application/Engine code depends only on this interface, never on a vendor SDK
directly. Mirrors `@flowmind/ai-contracts`; see ADR-0002.
