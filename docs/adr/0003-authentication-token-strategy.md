# 0003 — Authentication: scrypt Passwords, JWT Access + Rotated Opaque Refresh Tokens

- **Status**: Proposed (pending v0.4.0 PRD approval)
- **Date**: 2026-08-08

## Context

v0.4.0 introduces the project's first authentication system. No hashing library, JWT library, or
session mechanism exists anywhere in the codebase today — this decision starts from zero, not
from an existing partial implementation.

## Decision

1. **Passwords hashed with `crypto.scrypt`** (Node's standard library), not bcrypt or argon2.
   Implemented as a `PasswordHash` Domain value object, not an Application port — Domain already
   depends on `node:crypto` (`EntityId` uses `randomUUID`), so this is consistent with existing
   precedent, not a new exception to the "Domain has no infrastructure imports" rule (that rule
   targets frameworks/SDKs/vendor libraries, not the language's standard library).
2. **Access tokens are short-lived JWTs (15 min)**, signed with `jose` (not `jsonwebtoken`) —
   `jose` is ESM-native and actively maintained; `jsonwebtoken` is CJS with a callback-oriented
   API that fits awkwardly into this monorepo's all-ESM codebase. Issued via a new `TokenService`
   Application port, implemented in Infrastructure (this is a real Infrastructure concern: it
   depends on an external library and a secret from configuration).
3. **Refresh tokens are opaque random values** (`crypto.randomBytes(32)`), not JWTs. Stored as an
   httpOnly, Secure, `SameSite=Lax` cookie. The database stores only the token's SHA-256 hash.
4. **Refresh tokens rotate on every use** and share a `familyId`. Presenting an already-rotated
   (revoked) token — a signal of theft or replay — revokes the entire family, not just that token.

## Consequences

**Positive**

- Zero new dependency for password hashing.
- Access tokens never touch the database to verify (stateless JWT verification) — only refresh
  tokens hit storage, keeping the hot path (every authenticated request) fast.
- Rotation + family revocation contains the blast radius of a stolen refresh token to one
  detected reuse, not an indefinitely valid token.
- Refresh token in an httpOnly cookie is unreadable by JavaScript, reducing XSS token theft;
  access token kept in memory (never `localStorage`) on the frontend for the same reason.

**Negative / trade-offs**

- SHA-256 (not scrypt) for refresh tokens is a deliberate asymmetry: correct because the token is
  already high-entropy (256 bits) unlike a human-chosen password, and using scrypt here would
  cost CPU on every refresh with no security benefit against a value that's already
  brute-force-infeasible.
- No CSRF token is added — the only cookie-authenticated endpoint is `/auth/refresh`, and
  `SameSite=Lax` already blocks that cookie being sent on a cross-site POST. Every mutating
  workflow endpoint authenticates via the `Authorization` header (unreachable by a forged
  cross-site form/fetch without also stealing the token some other way), so a dedicated CSRF
  token would add complexity without addressing a live gap in this release's scope.
- No rate limiting on `/auth/login` this release — a real, documented gap (brute-force
  protection), not solved here. Tracked as follow-up work, not hidden.

## Alternatives considered

- **bcrypt/argon2 for passwords**: rejected for this release — both require native bindings,
  which have already caused friction on this project's Windows development machine (Docker/WSL2
  setup). `crypto.scrypt` needs no compilation step and is an accepted KDF.
- **`jsonwebtoken` for JWT**: rejected — CJS package in an all-ESM monorepo, awkward callback API
  compared to `jose`'s promise-based, ESM-native interface.
- **JWT refresh tokens (self-contained, stateless)**: rejected — a stateless refresh JWT cannot be
  revoked before its expiry without a separate blocklist (which reintroduces the storage this
  decision already needs for rotation/reuse-detection anyway), so an opaque, database-backed
  refresh token is simpler for the same amount of infrastructure.
- **Both tokens in `localStorage`**: rejected — maximal XSS exposure for both a token that can
  impersonate the user for 15 minutes and one that can do so indefinitely (via rotation) if
  stolen; the split (memory + httpOnly cookie) contains each token type to the threat model it
  actually faces.
