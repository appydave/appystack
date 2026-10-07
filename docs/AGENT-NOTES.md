---
generated: 2026-10-07
generator: system-context
audience: agent
status: snapshot
commit: c017ab1
sources:
  - package.json
  - template/package.json
  - template/server/src/config/env.ts
  - template/server/src/middleware/validate.ts
  - template/server/src/index.ts
  - template/client/vite.config.ts
  - template/scripts/start.sh
  - create-appystack/bin/index.js
  - create-appystack/bin/lib/classify.js
  - config/package.json
---

# AppyStack — Agent Notes

Only what the code cannot tell you. Each entry has its full story in `docs/kdd/learnings/`.

## Tooling

- Run `npm test` at the repo root. It runs the `create-appystack` suite, then the template suite. It
  installs either package's deps first if `node_modules` is missing. There is no root workspace; each
  package installs on its own.
- The template's tests need `shared` built first (`npm run build -w shared` inside `template/`); CI does
  the same. A fresh checkout without that build fails on unresolved `shared` imports.
- Don't run `npx husky init` in `template/`. It is not a git root, so husky fails. Edit
  `template/.husky/pre-commit` directly; a scaffolded app registers it through its `prepare: husky`
  script. (husky-nested-template)
- After publishing `create-appystack`, verify with `npx -p create-appystack@latest appystack-upgrade`.
  Plain `npx appystack-upgrade` resolves the thin wrapper package, and npx serves its cached
  `create-appystack`, i.e. the old code. (npx-cache-serves-stale-upgrade-tool)

## Pitfalls

- **dotenv `override` in the template's `env.ts` must stay conditional** (`override: !underTest`).
  `override: true` breaks the env tests in scaffolded apps. Dropping it lets a stale or injected `PORT`
  win under Overmind, so the server binds the wrong port and Socket.io hangs on "Loading…". Both
  "simplifications" have shipped before. Check `npm test` AND `overmind start`.
  (dotenv-override-clobbers-env-tests)
- **Express 5 `req.query` is getter-only.** Validation middleware must `Object.assign(req.query, …)`;
  `req.query = …` throws at runtime. (express5-req-query-readonly)
- **Port-conflict defence is three parts; keep all of them:** `strictPort: true` in the client Vite
  config, `--kill-others` in the root `dev` script, and `cleanupPort()` before `listen` in the server.
  Without them, an orphaned Vite moves to the server's port and the server dies with `EADDRINUSE`.
  (port-conflict-defence)
- **`overmind status` exits 0 even when every process is dead.** The liveness check in
  `scripts/start.sh` must grep the status for `running`, and must `overmind quit` a dead daemon rather
  than just deleting `.overmind.sock`. The 0.4.16 fix trusted the exit code and had to be redone in
  0.4.18.
  (start-sh-stale-overmind-socket)
- **Files that hold scaffold-time values (ports, scope) belong in the upgrade tool's `'never'` tier.**
  On a retrofit app the scaffold commit already contains those values, so `git diff` reports
  "unchanged" and an `'auto'` file would be silently overwritten with template placeholders. In
  `classify.js` the live lists are `NEVER_BASENAMES` / `NEVER_PREFIXES` / `NEVER_EXACT`. The exported
  `CLASSIFICATION.neverPatterns` mirrors them but nothing reads it, so editing only it changes nothing.
  Test upgrade-tool changes against a retrofit app, not only a fresh scaffold.
  (retrofit-scaffold-overwrite-bug)
- **`@appydave/appystack-config` `peerDependencies` cap the template's toolchain versions** (eslint,
  typescript-eslint, react-hooks, globals, prettier, typescript, vitest). Bumping one of these in
  `template/` past the config's peer range gives `ERESOLVE`. The fix is a coordinated bump: widen the
  peer range, publish the config, then the template adopts the new version. A bad config publish
  breaks lint in every consumer app. (config-peerdeps-gate-template-upgrades)

## Non-default conventions

- The template ships its ignore file as `template/gitignore` (no dot), because npm strips `.gitignore`
  from published packages. `create-appystack` renames it on scaffold. Don't "fix" the name.
