---
adr_number: 2
title: npm publish token — Bypass 2FA OFF, OTP at publish
status: accepted
created: 2026-07-12
decision_date: 2026-07-12
story_reference: ad-hoc (token rotation after expiry blocked v0.4.14 publish)
supersedes: ""
superseded_by: ""
sensitivity: normal
---

# ADR-002: npm Publish Token — Bypass 2FA OFF

## Status

Accepted

## Context

The `appydave-publish` granular npm token (in `~/.npmrc`) expired and blocked publishing. On
rotation, npm's granular-token form offers a **"Bypass two-factor authentication (2FA)"** option,
with a warning that it carries security risk and is meant for CI/CD (where Trusted Publishing /
OIDC is preferred). Publishing here is **manual and interactive** from David's Mac — not CI.

## Decision

Rotate with **Bypass 2FA OFF** (unchecked), Read+write, All packages, **90-day** expiry. Publishing
now requires a one-time code:
```
npm publish --access public --otp=<6-digit-code>
```
A plain `npm publish` returns `EOTP` — that is expected; supply the OTP and re-run. Operational
details live in `CLAUDE.md` (npm Publishing) — this ADR owns the *why*.

## Alternatives Considered

- **Bypass 2FA ON** — rejected: the plaintext `~/.npmrc` token would then be a full publish key on
  its own; a leak = anyone can publish. Off keeps the authenticator as a required second factor.
- **Trusted Publishing (OIDC)** — deferred: only relevant if/when publishing moves to CI/GitHub Actions.

## Consequences

- A leaked token cannot publish without David's authenticator — real supply-chain protection for a
  public package others depend on.
- Cost: one 6-digit code per publish session (a few times a year) — negligible.
- Rotation is a routine 90-day refresh, not an emergency (as the expiry-block was).

## Related

- Patterns: []
- Learnings: []
- Stories: ad-hoc 2026-07-12 (v0.4.14 publish)
- Operational procedure: `CLAUDE.md` → npm Publishing
