---
topic: Environment config / scaffold tests
issue: dotenv override:true makes the shipped .env clobber test-set process.env → env tests fail on a pristine scaffold
created: 2026-07-12
story_reference: ad-hoc (surfaced building captains-log; fix commit 72b2086)
category: testing
severity: high
status: resolved
recurrence_count: 1
promoted_to_pattern: ""
sensitivity: normal
---

# dotenv `override: true` Clobbers Test Env — Scaffold Ships Red

## Problem Signature

**Symptoms**: A freshly scaffolded app fails **6 of 7** env tests immediately on `npm test`
(e.g. `expected 'development' to be 'test'`, `expected 5501 to be 9999`).

**Environment**: `server/src/config/env.ts` in a scaffolded app (NOT the template repo — see below).

**Triggering Conditions**: `env.test.ts` sets `process.env.NODE_ENV='test'` / `PORT='9999'`, then
dynamically imports `env.ts`. On import, `env.ts` calls dotenv with `override: true`, loading the
scaffolded app's root `.env` (`NODE_ENV=development`, `PORT=5501`) **over** the values the test
just set. The env module can never see test inputs.

## Root Cause

```typescript
// WRONG — override forces .env to win over process.env
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env'), override: true });
```
`override: true` inverts the conventional precedence. The nuance that hid it: the **template repo
ships only `.env.example`** (no real `.env`), so the tests pass *there* — the bug only bites in a
*scaffolded app*, which does ship a real `.env`. Green in the template, red for every consumer.

## Solution

```typescript
// RIGHT — conventional precedence: explicit process/shell env wins, .env fills gaps
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
```
Proven A/B: with `override` → 6/7 env tests fail; without → 7/7 pass (66/66 server suite) with a
scaffold-style `.env` present. Fixed in root `template/` + synced to `create-appystack/`. Shipped
in `create-appystack@0.4.14`.

## Prevention

- **For Dev**: never use `dotenv override: true` in a library/template — let process env win.
- **For Review**: `override: true` on a dotenv call is a red flag in any tested module.
- **For Stories**: "green in the template" ≠ "green when scaffolded" — verify against a real
  scaffold with a real `.env`, since the template ships only `.env.example`.

## Related

- Story: ad-hoc 2026-07-12 (captains-log)
- Related learnings: [[port-conflict-defence]] (env/port scaffold behaviour)
- Related patterns: []
