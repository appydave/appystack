# IMPLEMENTATION_PLAN.md — AppyStack Wave 2

**Goal**: CI pipeline, npm publish, coverage thresholds, post-publish template migration, and template polish.
**Branch**: `main` (merged)
**Started**: 2026-02-26
**Completed**: 2026-02-26
**Target**: All 9 work units complete. Config package published to npm. CI runs green. Template imports from npm.

## Summary
- Total: 9 | Complete: 9 | In Progress: 0 | Pending: 0 | Failed: 0

## Dependency Order

```
WU-1 (fix README)    ──┐
                       ├──▶ WU-3 (publish to npm) ──▶ WU-5 (file: → npm)
WU-2 (pack test)     ──┘                          └──▶ WU-6 (inline ESLint → import)

WU-4 (CI workflow)     ─── independent, run in parallel with WU-1/2/3

WU-7 (coverage)        ─── independent after WU-4 (wires into CI)
WU-8 (env typing)      ─── independent
WU-9 (path aliases)    ─── independent
```

**Wave A** (run in parallel): WU-1, WU-2, WU-4
**Wave B** (after WU-2 + WU-3): WU-3
**Wave C** (after WU-3): WU-5, WU-6
**Wave D** (independent polish): WU-7, WU-8, WU-9

---

## Complete

### Phase 1: Config Package — Fix & Publish

#### [x] WU-1: Rewrite config/README.md
Completed. All `@flivideo/config`, `FliStack`, `FliVideo`, `fliConfig` references replaced with `@appydave/appystack-config`, `AppyStack`, `appyConfig`. vitest/client example added.

---

#### [x] WU-2: npm pack smoke test
Completed. `npm pack --dry-run` listed all expected files. Tarball installed cleanly into temp directory. All exported paths resolve.

---

#### [x] WU-3: Publish config to npm
Completed. Published `@appydave/appystack-config@1.0.0` to npm. Later bumped to `1.0.1` to fix vitest peer dep (`^4.1.1` → `^4.0.0`). Both versions confirmed on npm.

---

### Phase 2: GitHub Actions

#### [x] WU-4: CI + publish workflows
Completed. `.github/workflows/ci.yml` created (push + PR triggers, runs format, lint, build, test, playwright e2e). `.github/workflows/publish.yml` created (tag trigger, publishes to npm with `--provenance`).

---

### Phase 3: Post-Publish Template Migration

#### [x] WU-5: Switch template from file: to npm
Completed. `template/package.json` now references `"@appydave/appystack-config": "^1.0.0"`. package-lock.json regenerated. All validation commands pass.

---

#### [x] WU-6: Switch template ESLint from inlined to imported
Completed. `template/eslint.config.js` reduced from 65 lines to 3. Import pattern uses `@appydave/appystack-config/eslint/react`. All lint checks pass.

---

### Phase 4: Coverage Thresholds

#### [x] WU-7: Enable coverage thresholds
Completed. Both vitest configs have thresholds: `lines: 80, functions: 70, branches: 70, statements: 80`. Server coverage: 86%, client: 97%. CI includes coverage step.

---

### Phase 5: Template Polish

#### [x] WU-8: Client environment variable typing
Completed. `client/src/vite-env.d.ts` has `ImportMetaEnv` interface with `VITE_API_URL` and `VITE_APP_NAME`. `.env.example` updated. TypeScript accepts the new types.

---

#### [x] WU-9: TypeScript path aliases for client
Completed. `client/tsconfig.json` has `baseUrl` and paths for `@components/*`, `@hooks/*`, `@pages/*`, `@utils/*`. `client/vite.config.ts` has matching `resolve.alias` entries. Build passes.

---

## Notes & Decisions

- **npm 2FA / OTP issues**: Classic npm tokens are revoked by npm. Use granular access tokens with "Bypass two-factor authentication" checkbox checked for CI. GitHub secret `NPM_TOKEN` must be updated with the bypass-2FA granular token.
- **vitest peer dep**: `^4.1.1` doesn't exist on npm. Fixed to `^4.0.0` in `config/package.json` → published as `1.0.1`.
- **package-lock.json regeneration**: After publishing 1.0.1, the lock file needed full regeneration (delete + fresh install) to pick up the new version. `npm cache clean` alone insufficient.
- **shared package build**: On a fresh install, `npm run build` must be run before `npm run dev` because the server imports `@appystack-template/shared/dist/index.js`. Fixed in `docs/getting-started.md`.
- **Vite tsconfig warning**: Vite shows "Cannot find base config file @appydave/appystack-config/typescript/react" on fresh install. This is from tsconfck's exports resolution for JSON files. Non-fatal — TypeScript compilation (tsc) resolves it correctly via exports. Vite's JSX handling is unaffected because `@vitejs/plugin-react` handles it.
- **Distribution**: GitHub template feature enabled. degit path: `npx degit appydave/appystack/template my-app`. Full guide at `docs/getting-started.md`.
- **NPM_TOKEN secret**: GitHub secret needs to be updated with new granular bypass-2FA token before the publish.yml workflow will work end-to-end.

## Failed / Needs Retry
(none)

## Pending
(none — campaign complete)
