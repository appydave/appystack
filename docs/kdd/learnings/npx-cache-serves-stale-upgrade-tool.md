---
topic: npx caching / publishing
issue: npx re-ran a stale cached create-appystack (via the appystack-upgrade wrapper) after a fresh publish
created: 2026-07-12
story_reference: ad-hoc (captains-log upgrade; create-appystack 0.4.15→0.4.17)
category: tooling
severity: medium
status: resolved
recurrence_count: 1
promoted_to_pattern: ""
sensitivity: normal
---

# npx Serves a Stale Cached Upgrade Tool After Publishing

## Problem Signature

**Symptoms**: publish `create-appystack@0.4.17`, then run `npx appystack-upgrade` in a consumer app
— and it still runs the **old** behaviour (old prompts, code you just removed). The registry has the
new version; npx runs the old one.

**Environment**: `npx appystack-upgrade` in any consumer app, where `appystack-upgrade` is a thin
**wrapper** package that depends on `create-appystack: ^0.4.0` and delegates to its `bin/upgrade.js`.

**Triggering Conditions**: npx caches a resolved package tree under `~/.npm/_npx`. Once
`appystack-upgrade@0.4.2` (the wrapper — its own version rarely changes) has been run, npx reuses
the cached install **including the `create-appystack` it pulled in at that time**. A newer
`create-appystack` on the registry is not re-fetched, because a satisfying version is already cached.

## Root Cause

Two compounding factors:
1. **Indirection**: `npx appystack-upgrade` resolves the *wrapper*, not `create-appystack` directly.
   The wrapper's version is stable (0.4.2), so npx sees "nothing new to fetch" and serves the whole
   cached tree — stale transitive `create-appystack` and all.
2. **npx caches by name+version and does not re-resolve `^` ranges on every run.** The fix code
   lives in the *transitive* dep, which npx never re-checks.

## Solution

Force npx to install the latest `create-appystack` and run its bundled `appystack-upgrade` bin
directly, bypassing the stale wrapper tree:
```bash
# WRONG after a publish — may reuse a cached create-appystack:
npx appystack-upgrade

# RIGHT — forces create-appystack@latest, runs its own appystack-upgrade bin:
npx -p create-appystack@latest appystack-upgrade
```
`create-appystack`'s `package.json` exposes `"bin": { "create-appystack": ..., "appystack-upgrade":
"bin/upgrade.js" }`, so `-p create-appystack@latest appystack-upgrade` runs the just-published code.
Alternative sledgehammer: `rm -rf ~/.npm/_npx` then re-run.

## Prevention

- **For Dev**: after publishing, verify a consumer picks up the change with the pinned form
  (`npx -p <pkg>@latest <bin>`), not the bare wrapper name. Don't trust `npx <wrapper>` to reflect a
  fresh transitive publish.
- **For Review**: a thin wrapper package that delegates to a `^`-ranged dependency will mask that
  dependency's updates behind npx's cache — document the pinned invocation.
- **For Docs**: the app's upgrade instructions should give the `-p create-appystack@latest` form.

## Related

- Story: ad-hoc 2026-07-12 (captains-log)
- Related learnings: [[start-sh-stale-overmind-socket]] (same session's other "why isn't the fix taking effect" trap)
- Related patterns: []
