---
topic: Environment config / scaffold tests
issue: dotenv override precedence must flip between test and runtime — either fixed value breaks the other path
created: 2026-07-12
story_reference: ad-hoc (surfaced building captains-log; commits 72b2086 then follow-up conditional fix)
category: testing
severity: high
status: resolved
recurrence_count: 2
promoted_to_pattern: ""
sensitivity: normal
---

# dotenv `override` — Test and Runtime Want Opposite Precedence

> **Recurrence 2 — corrected 2026-07-12.** The first fix (commit 72b2086: *drop* `override`) was
> **incomplete** — it fixed the tests but reintroduced a documented runtime wrong-port bug under
> Overmind / stale-shell PORT (see [[port-conflict-defence]], BACKLOG "dotenv silently fails").
> The two paths want **opposite** precedence; only a conditional satisfies both. Do not "simplify"
> this back to a single unconditional `override` value — that is the trap, in both directions.

## Problem Signature

**Symptoms** (two failure modes, opposite causes):
- With `override: true` → a scaffolded app fails **6 of 7** env tests (`expected 'development' to
  be 'test'`, `expected 5501 to be 9999`) — the shipped `.env` clobbers the values the test set.
- With `override` dropped → the server **silently binds the wrong port** under Overmind: a stale
  or injected `PORT` in the environment wins over `.env`; client proxy points one way, server
  listens another; Socket.io hangs on "Loading…". Green under `npm run dev` (nothing injects PORT),
  broken under `overmind start`.

**Environment**: `server/src/config/env.ts` in a scaffolded app. The template repo ships only
`.env.example` (no real `.env`), so the *test* symptom is invisible there — it only bites consumers.

## Root Cause

Test and runtime need **opposite** dotenv precedence:
- **Test**: the values `env.test.ts` sets on `process.env` must win → `override: false`.
- **Runtime** (dev/prod/**Overmind**): `.env` must win over any stale/injected `PORT` → `override: true`.
  (`override:true` was originally in the template *on purpose* for this — `scripts/start.sh` even
  documents "env.ts uses override:true so .env wins". Dropping it looked like a cleanup but removed
  load-bearing behaviour.)

A single fixed value can only ever satisfy one path.

## Solution

Flip `override` on whether we're under test — proven empirically both ways:
```typescript
// WRONG (either way): a single fixed value breaks the other path
// dotenv.config({ ..., override: true });   // tests fail
// dotenv.config({ ... });                    // Overmind binds wrong port

// RIGHT: override OFF under test (test process.env wins), ON at runtime (.env wins)
const underTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env'), override: !underTest });
```
`VITEST` catches the `env.test.ts` cases that set `NODE_ENV` to `development`/`production`;
`NODE_ENV === 'test'` is the belt-and-braces catch. Verified: env tests 7/7, server suite 66/66;
and a runtime probe with injected `PORT=9999` + `.env` `PORT=5501` → **5501 wins** (override on),
while the same probe with `NODE_ENV=test` or `VITEST=true` → **9999 wins** (override off).

## Prevention

- **For Dev**: never make dotenv precedence unconditional in this template — test and runtime
  disagree. If you touch this line, keep the `underTest` guard.
- **For Review**: a bare `dotenv.config()` OR a bare `override: true` here is a regression — one
  breaks tests, the other breaks Overmind. Only the conditional is correct.
- **For Stories**: verify BOTH paths — `npm test` (tests green) AND `overmind start` (server binds
  the `.env` PORT, not an injected one). "Green under `npm run dev`" proves nothing about Overmind.

## Related

- Story: ad-hoc 2026-07-12 (captains-log)
- Related learnings: [[port-conflict-defence]] (the runtime wrong-port failure mode this protects against)
- Related patterns: []
