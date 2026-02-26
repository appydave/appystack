# IMPLEMENTATION_PLAN.md — AppyStack Template Improvements

**Goal**: Make the AppyStack RVETS template production-ready — typed Socket.io, error handling, test infrastructure, security, DX tooling, and Docker deployment.
**Branch**: `appystack-template-improvements`
**Worktree**: `.worktrees/appystack-template-improvements`
**Started**: 2026-02-26
**Completed**: 2026-02-26
**Target**: All 19 work units complete, template passes full validation (format, lint, build, test)

## Summary
- Total: 19 | Complete: 19 | In Progress: 0 | Pending: 0 | Failed: 0

## Complete

### Phase 1: Foundation Fixes
- [x] WU-1: Dependency cleanup — formidable removed, phantom deps audited (pre-existing)
- [x] WU-2: Shared package — split types + add constants (commit 8c8f05d)
- [x] WU-3: Error handling — server — AppError, errorHandler, validate, response helpers (commit 59ea428)
- [x] WU-4: Error handling — client — ErrorFallback + ErrorBoundary wrapper (commit 36aa23f)

### Phase 2: Socket.io + Data Fetching
- [x] WU-5: Socket.io overhaul — typed generics, SOCKET_EVENTS constants, SocketDemo component (commit 3769123)
- [x] WU-6: Data fetching — AbortController + AbortSignal.any() timeout (commit c055ffc)

### Phase 3: Security + DX
- [x] WU-7: Security — rate limiting — express-rate-limit wired before routes (commit f5c0db8)
- [x] WU-8: Git hooks — husky + lint-staged, pre-commit hook created manually (commit 32ee9ae)
- [x] WU-9: VS Code debug configs — launch.json with 4 configs + Full Stack compound (commit a2f66b3)

### Phase 4: Test Infrastructure
- [x] WU-10: Co-locate tests — health+info split, App.test moved, server/test/ deleted (commit a9d2e93)
- [x] WU-11: Coverage config — @vitest/coverage-v8, coverage blocks, commented thresholds (commit 464a7cc)

### Phase 5: Unit Tests
- [x] WU-12: Server middleware tests — env, errorHandler, validate, rateLimiter — 31 server tests (commit 7ec8d0f)
- [x] WU-13: Server socket tests — 5 real ping/pong tests + fixed Express 5 req.query bug (commit 3acfa27)
- [x] WU-14: Client hook tests — useServerStatus (6) + useSocket (4), real servers (commit b14bf4e)
- [x] WU-15: Client component tests — 37 tests across 5 components, 81 total (commit 97b3d19)
- [x] WU-16: Playwright smoke test — 3 E2E tests, 3 consecutive clean runs (commit f518ac1)

### Phase 6: Production + Polish
- [x] WU-17: Production deployment — multi-stage Dockerfile, docker-compose, SPA static serving (commit 8665631)
- [x] WU-18: Config package fixes — prepublishOnly, peerDependenciesMeta, vitest/client.config.ts (commit ad2bd48)
- [x] WU-19: Customization script — @clack/prompts interactive script, rewrites 8 files (commit 77b7136)

## In Progress
(none)

## Failed / Needs Retry
(none)

## Notes & Decisions
- WU-1 already complete before campaign started (formidable was removed in a prior commit)
- Work units in Phase 1 (WU-2, WU-3, WU-4) ran in parallel — touched different packages
- WU-5 depended on WU-2 (needed split types) — ran in Wave 2 after Wave 1 complete
- LEARNING (WU-8): template/ is nested inside repo — `npx husky init` cannot run from template/; .husky/pre-commit created manually
- LEARNING (WU-13): Express 5 makes req.query read-only — use Object.assign(req.query, ...) not direct assignment; fixed in validate.ts
- WU-16 finding: process group kill needed for nodemon/tsx children — use spawn({ detached: true }) + process.kill(-pid, 'SIGTERM')
- WU-18 committed to both parent repo (config/) and worktree (template/ lint fix)
- Final test count: 81 unit tests (31 server + 50 client) + 3 Playwright E2E
