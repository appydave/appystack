# Bug: Retrofit scaffold causes silent overwrite of customized auto-tier files

**Discovered**: WU10 (DeckHand test), 2026-03-11
**Severity**: High — silent data loss (port config, scope imports overwritten)

## What happened

Running `appystack-upgrade --yes` against DeckHand (a retrofit/merge-mode scaffold) silently overwrote 4 files that had project-specific values:

- `client/src/lib/entitySocket.ts` — `@appydave/shared` → `@appystack-template/shared`
- `server/src/config/env.ts` — ports 5031/5030 → 5501/5500 (template defaults)
- `server/src/routes/health.ts` — scope replacement
- `server/src/routes/info.ts` — scope replacement

## Root cause

The diff engine checks: `git diff <scaffoldCommit> -- <file>`. For retrofit apps, the scaffold commit already contains project-specific customizations (scope, ports set at scaffold time). So the diff returns empty — "no changes since scaffold" — meaning the file appears safe to auto-update. But the template version uses placeholder values, causing silent regression.

The tool cannot distinguish "this value was customized at scaffold time" from "this value was never changed" using the git-diff approach alone.

## Fix options

1. **Move these specific files to `'never'` tier** — simplest MVP fix. `entitySocket.ts`, `env.ts`, `health.ts`, `info.ts` all contain port/scope values set at scaffold time. Once customized they're effectively project-owned. Trade-off: lose upgrade capability for these files.

2. **Template-diff approach** — compare template-at-scaffold-version vs template-at-latest to identify which files actually changed in the template. Only update if the template changed AND the consumer is unchanged. Requires tagging template versions in git. More accurate but more complex.

3. **Placeholder detection** — after applying an update, check if the result contains known template placeholder values (`@appystack-template`, port `5500`/`5501`). If so, revert and prompt. Hacky but pragmatic.

## Recommended fix (for next wave)

Move `server/src/config/env.ts`, `server/src/routes/health.ts`, `server/src/routes/info.ts`, and `client/src/lib/entitySocket.ts` to the `'never'` tier in `classify.js`. These files are customized at scaffold time (scope, ports) and are effectively project-owned once scaffolded. They rarely change in the template in ways that matter to consumer apps.

Keep `server/src/middleware/*` and `client/src/hooks/useSocket.ts` as `'auto'` — these don't contain project-specific values.

## What was reverted

The agent manually reverted the 4 files before committing. `appystack.json` was committed correctly.
