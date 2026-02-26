# IMPLEMENTATION_PLAN.md — AppyStack Template Improvements

**Goal**: Make the AppyStack RVETS template production-ready — typed Socket.io, error handling, test infrastructure, security, DX tooling, and Docker deployment.
**Branch**: `appystack-template-improvements`
**Worktree**: `.worktrees/appystack-template-improvements`
**Started**: 2026-02-26
**Target**: All 19 work units complete, template passes full validation (format, lint, build, test)

## Summary
- Total: 19 | Complete: 1 | In Progress: 0 | Pending: 18 | Failed: 0

## Complete
- [x] WU-1: Dependency cleanup — formidable removed, phantom deps audited

## Pending

### Phase 1: Foundation Fixes
- [ ] WU-2: Shared package — split types + add constants
- [ ] WU-3: Error handling — server
- [ ] WU-4: Error handling — client

### Phase 2: Socket.io + Data Fetching
- [ ] WU-5: Socket.io overhaul
- [ ] WU-6: Data fetching — AbortController

### Phase 3: Security + DX
- [ ] WU-7: Security — rate limiting
- [ ] WU-8: Git hooks
- [ ] WU-9: VS Code debug configs

### Phase 4: Test Infrastructure
- [ ] WU-10: Move tests to co-located structure
- [ ] WU-11: Coverage configuration

### Phase 5: Unit Tests
- [ ] WU-12: Server unit tests — routes + middleware
- [ ] WU-13: Server socket tests
- [ ] WU-14: Client hook tests
- [ ] WU-15: Client component tests
- [ ] WU-16: Playwright smoke test

### Phase 6: Production + Polish
- [ ] WU-17: Production deployment
- [ ] WU-18: Config package fixes
- [ ] WU-19: Customization script

## In Progress
(coordinator moves items here with [~])

## Failed / Needs Retry
(coordinator moves items here with [!], adds failure reason)

## Notes & Decisions
- WU-1 already complete before campaign started (formidable was removed in a prior commit)
- Work units in Phase 1 (WU-2, WU-3, WU-4) can run in parallel — they touch different packages
- WU-5 depends on WU-2 (needs the split types), so WU-5 must follow WU-2
- WU-10 (co-locate tests) should run before WU-12–15 (unit tests) to establish the correct file structure
- WU-12–15 depend on WU-3/WU-4/WU-7 (middleware must exist before middleware tests)
- AGENTS.md path in worktree: `docs/planning/appystack-template-improvements/AGENTS.md`
- Template path in worktree: `.worktrees/appystack-template-improvements/template/`
