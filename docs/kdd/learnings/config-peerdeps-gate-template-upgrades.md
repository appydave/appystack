---
topic: Dependency upgrades / two-package coupling
issue: "@appydave/appystack-config peerDependencies cap which template dep versions can be adopted"
created: 2026-07-12
story_reference: ad-hoc (Tier 1+2 upgrade wave, 2026-07-12)
category: tooling
severity: medium
status: active
recurrence_count: 2
promoted_to_pattern: ""
sensitivity: normal
---

# Config `peerDependencies` Gate Template Dependency Upgrades

> **Recurrence 2** (globals-17 ERESOLVE + the whole eslint-10 coupling analysis, same session).
> One more independent hit → **pattern promotion candidate**: "shared-config peer ranges are the
> real ceiling on consumer upgrades."

## Problem Signature

**Symptoms**: `npm install <pkg>@<newmajor>` in `template/` fails with `ERESOLVE could not
resolve` — a peer conflict, not a template problem.

**Environment**: The template consumes `@appydave/appystack-config`, whose `peerDependencies` pin
toolchain floors (`eslint ^9.17`, `@typescript-eslint ^8.20`, `eslint-plugin-react-hooks ^5.1`,
`globals ^15.14`, `prettier ^3.4`, `typescript ^5.7`, `vitest ^4.0`).

**Triggering Conditions**: bumping any of those packages in the template *past* the config's peer
range. Hit live when `globals@17` tripped ERESOLVE against the config's `globals ^15.14` peer.

## Root Cause

A peer dependency is a **contract**, not an install: the config declares "whoever uses me must
have globals 15 / eslint 9". The config is published separately and consumed by the template AND
by every real app (FliGen/FliHub/FliDeck/Storyline). So any dep that appears in the config's
`peerDependencies` **cannot exceed that range in the template without bumping the config's peer
range and republishing the config in lockstep** — and a bad config publish breaks lint fleet-wide
on the next `npm install`.

## Solution

- **Rule of thumb**: before a template dep bump, check `config/package.json` `peerDependencies`.
  In range → safe (Tier 1/2). Out of range → it's a **coordinated Tier-3** bump: widen config
  peers → publish config → then template adopts.
- Keep config peer ranges **wide** (e.g. `^9 || ^10`), not pinned, so consumers aren't boxed in.
- Verify the config's preset consumption still works after the bump (plugins change the *shape* of
  `.configs.recommended` — cherry-picking `.rules` can silently yield zero rules; force a known
  violation to confirm rules still fire, don't trust a green `lint`).

## Prevention

- **For Dev**: `npm outdated` "Latest" crossing a major that's a config peer = stop, coordinate.
- **For Review**: a template devDep version outside the config's peer range is a defect (breaks consumer installs).
- **For Stories**: dep-upgrade work must state which bumps are config-coupled.

## Related

- Story: ad-hoc 2026-07-12 (Tier 1+2 upgrade wave)
- Related learnings: [[retrofit-scaffold-overwrite-bug]] (also template/consumer drift)
- Related decisions: [[adr-001-hold-eslint-10]]
- Related patterns: [] (promotion candidate)
