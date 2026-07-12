---
topic: appystack-upgrade tool
issue: retrofit scaffold silently overwrites customized auto-tier files
created: 2026-03-11
story_reference: Wave 6 / WU10 (DeckHand test)
category: tooling
severity: high
status: active
recurrence_count: 1
promoted_to_pattern: ""
sensitivity: normal
---

# Retrofit Scaffold Causes Silent Overwrite of Customized Auto-Tier Files

> **Status: ACTIVE** — recommended fix (move files to `'never'` tier) is documented below but
> confirm whether it has actually been applied in `classify.js` before closing.

## Problem Signature

**Symptoms**: `appystack-upgrade --yes` against a retrofit/merge-mode app silently overwrote 4
files carrying project-specific values — silent data loss (ports, scope imports reverted to
template defaults):
- `client/src/lib/entitySocket.ts` — `@appydave/shared` → `@appystack-template/shared`
- `server/src/config/env.ts` — ports 5031/5030 → 5501/5500
- `server/src/routes/health.ts` — scope replacement
- `server/src/routes/info.ts` — scope replacement

**Environment**: `appystack-upgrade` on DeckHand (a retrofit scaffold, ports 5031/5030).

## Root Cause

The diff engine runs `git diff <scaffoldCommit> -- <file>`. For **retrofit** apps the scaffold
commit *already contains* the project's customizations (scope/ports set at scaffold time), so the
diff is empty — "unchanged since scaffold" — and the file looks safe to auto-update. But the
template version holds placeholder values, so the update silently regresses them. Git-diff alone
can't tell "customized at scaffold time" from "never changed".

## Solution

Fix options considered:
1. **Move the 4 files to `'never'` tier** (recommended MVP) — they hold port/scope values set at
   scaffold time and are effectively project-owned. Trade-off: lose upgrade capability for them.
2. **Template-diff approach** — compare template@scaffold-version vs template@latest; update only
   if the template actually changed AND the consumer is unchanged. Needs version-tagged template
   commits. More accurate, more complex.
3. **Placeholder detection** — after applying, if the result contains known placeholders
   (`@appystack-template`, `5500`/`5501`), revert + prompt. Hacky but pragmatic.

Recommended (next wave): move `server/src/config/env.ts`, `server/src/routes/health.ts`,
`server/src/routes/info.ts`, `client/src/lib/entitySocket.ts` to `'never'` in `classify.js`. Keep
`server/src/middleware/*` and `client/src/hooks/useSocket.ts` as `'auto'` (no project values).
The agent manually reverted the 4 files before committing; `appystack.json` committed correctly.

## Prevention

- **For Dev**: files with scaffold-time values (ports, scope) belong in the `'never'` tier, not `'auto'`.
- **For Review**: any new `'auto'`-tier classification for a file containing ports/scope is a red flag.
- **For Stories**: upgrade-tool work must test against a *retrofit* app, not just fresh scaffolds.

## Related

- Story: Wave 6, WU10
- Related learnings: [[config-peerdeps-gate-template-upgrades]] (also upgrade-tool / template drift)
- Related patterns: []
