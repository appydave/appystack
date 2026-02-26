# Next Round Brief — AppyStack Wave 2

**Created**: 2026-02-26
**Follows**: appystack-template-improvements campaign (19 WUs complete)
**Goal**: CI pipeline, npm publish, coverage thresholds, and optional MSW pattern

---

## Background

Wave 1 (appystack-template-improvements) made the RVETS template production-ready:
typed Socket.io, error handling, rate limiting, DX tooling, 84 tests (81 unit + 3 E2E),
Docker deployment, and a customization script.

Wave 2 closes the remaining gaps: automated CI, the config package rename and publish,
and raising the coverage bar now that a baseline exists.

---

## Suggested Work Items

### High Priority

1. **GitHub Actions CI** — Add `.github/workflows/ci.yml` that runs on push/PR:
   format:check → lint → build → test → test:e2e (with Playwright browsers installed).
   Block merges on failure.

2. **Rename + publish config package** — Rename `@flivideo/config` → `@appydave/appystack-config`
   in config/package.json. Create `@appydave` org on npm. Publish. Update template consumer
   references from `file:` path to npm package name.

3. **Enable coverage thresholds** — Uncomment the threshold blocks in server and client
   vitest.config.ts (lines: 80, functions: 80, branches: 80, statements: 80). Fix any
   files below threshold. Wire coverage into CI.

### Medium Priority

4. **MSW (Mock Service Worker) pattern** — Add an optional `msw` setup example in
   `client/src/test/` showing how to intercept fetch at the browser level for
   component tests that can't spin up a real server (e.g. Storybook, isolated renders).
   Document it in AGENTS.md as an alternative pattern.

---

## AGENTS.md Inheritance

Inherit `docs/planning/appystack-template-improvements/AGENTS.md` — it's already rich
with build commands, patterns, anti-patterns, and two critical operational notes
(husky nested template, Express 5 req.query). Do not rebuild from scratch.

Key additions needed for Wave 2:
- npm publish workflow (org setup, token, `npm publish --access public`)
- GitHub Actions syntax for this stack
- Coverage threshold targets
