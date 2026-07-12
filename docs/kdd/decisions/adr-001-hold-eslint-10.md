---
adr_number: 1
title: Hold ESLint 10 until eslint-plugin-react supports it
status: accepted
created: 2026-07-12
decision_date: 2026-07-12
story_reference: ad-hoc (Tier-3 eslint/config Phase-0 probe)
supersedes: ""
superseded_by: ""
sensitivity: normal
---

# ADR-001: Hold ESLint 10 Until `eslint-plugin-react` Supports It

## Status

Accepted

## Context

ESLint 10 is out. Adopting it in the template + `@appydave/appystack-config` is a Tier-3
coordinated bump (config peer ranges + republish). A read-only Phase-0 probe (throwaway install +
real lint runs under eslint 10) established:

- ✅ **base/server config** works under eslint 10 — `@typescript-eslint` 8.63 supports eslint
  8/9/10; presets fire (caught `no-unused-vars` + `no-explicit-any` in a live run).
- ✅ **eslint-plugin-react-hooks 7** is safe — `.configs.recommended.rules` is still an object
  (16 rules); the feared v6 array-shape regression is gone.
- ✅ **globals 17** is trivial (data package).
- ❌ **`eslint-plugin-react@7.37.5`** (latest, no pre-release) caps its peer at `eslint ^9.7` and
  **crashes at runtime under eslint 10** (`getFilename is not a function`). Fix
  [PR #3979](https://github.com/jsx-eslint/eslint-plugin-react/issues/3977) is open, **no ETA**.

The client/React config and every consumer app use `eslint-plugin-react`, so it's a hard blocker.

## Decision

**Hold the entire Tier-3 eslint/config bump.** Stay on ESLint 9 (current + maintained). Do not
adopt react-hooks 7 / globals 17 on their own — not worth a fleet-wide config republish.

**Unblock signal** (check any time):
`npm view eslint-plugin-react@latest peerDependencies` shows an `eslint` range including `^10`.

## Alternatives Considered

- **Force with `--legacy-peer-deps`** — rejected: the plugin *crashes*, not just warns.
- **Migrate to flat-native `@eslint-react/eslint-plugin`** (eslint-10 ready) — deferred: real
  project, different rule set, touches the config's public contract + the whole fleet.
- **Drop `eslint-plugin-react` entirely**, keep react-hooks + TS — deferred: loses JSX style rules.

## Consequences

- Zero functional loss today; eslint 9 is fine.
- When the plugin ships eslint-10 support, the rest of the path is proven → Phases 1–4 become
  mechanical (widen config peers, republish config, bump template, gate).

## Related

- Patterns: []
- Learnings: [[config-peerdeps-gate-template-upgrades]]
- Stories: ad-hoc 2026-07-12
