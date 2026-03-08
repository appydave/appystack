# AppyStack Upgrade Strategy

**Status:** Design concept — implement when 3+ consumer apps exist (ThumbRack + 2 more)
**Inspired by:** Nx migrations (nx migrate latest)

---

## The Problem

When AppyStack evolves — new patterns discovered, bugs fixed, recipes improved — consumer apps
(ThumbRack, Signal Studio, etc.) have no way to pull those improvements in. They were scaffolded
once and diverged from that point.

## The Insight (from Nx)

Nx attaches versioned migration scripts to each version bump. When you upgrade Nx 17→18, it runs
migration scripts that know exactly which files to touch.

AppyStack can do the same:

```
appystack-migrations/
  v0.2.0-to-v0.3.0.js   ← "add Procfile, update CLAUDE.md port rule"
  v0.3.0-to-v0.4.0.js   ← "update CI workflow, bump @appydave/appystack-config"
```

## The Git Anchor

The initial scaffold commit IS the baseline. Every consumer app starts with:
```
548f6fa chore: initial scaffold from create-appystack
```

To check if a file has been customised since scaffold:
```bash
git diff 548f6fa -- server/src/middleware/errorHandler.ts
```

- **Empty diff** → file is unchanged → safe to auto-update
- **Has diff** → file was customised → show diff, ask developer to merge

## File Classification

### Auto-updatable (safe to overwrite if unchanged)
- `server/src/middleware/` — errorHandler, rateLimiter, requestLogger, validate
- `.github/workflows/ci.yml` — generic CI
- `eslint.config.js`, `tsconfig.json` files — extend from config package
- `server/src/routes/health.ts`, `info.ts` — template routes
- `client/src/hooks/useSocket.ts` — template hook
- `client/src/lib/entitySocket.ts` — singleton

### Config-package-inherited (already auto-upgrade via npm)
- `eslint.config.js` (imports from `@appydave/appystack-config`)
- `tsconfig.json` files (extends from config package)
- `.prettierrc` (points to config package)

### Never auto-update (project owns these)
- `package.json` files (scopes, names, dependencies)
- `shared/src/types.ts` (domain model)
- `server/src/routes/` (except health/info)
- `client/src/` pages, components, hooks (except template hooks)
- `.env` / `.env.example`
- `CLAUDE.md`
- `README.md`

## Implementation Plan (when ready)

1. **Tag each template release** with a version (e.g. `template-v0.3.0`)
2. **Write migration scripts** as JS files in `appystack-migrations/`
3. **CLI command:** `npx appystack-upgrade` in a consumer app:
   - Detects current template version (stored in a `appystack.json` file at scaffold time)
   - Downloads migration scripts between current and latest
   - For each file in migration: check git diff against scaffold commit
   - Clean files → apply automatically
   - Modified files → show diff, offer manual merge
4. **Scaffold-time change:** `create-appystack` writes `appystack.json` with template version

## What to do now

Nothing — document this, then implement when 3+ consumer apps exist so you have real migration
scenarios to test against. The classification above is the most important output of this doc.
