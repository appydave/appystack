# Troubleshooting

> Common issues in the AppyStack template and config package — symptoms, causes, and fixes.

---

## 1. Shared Build Order — Server Cannot Find Shared Types

**Symptoms**

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@appystack-template/shared'
error TS2307: Cannot find module '@appystack-template/shared'
```

**Cause**

The server imports from `@appystack-template/shared`, which resolves to `shared/dist/`. That directory does not exist until shared is built. Workspace hoisting symlinks the package but cannot create compiled output.

**Fix**

```bash
npm run build -w shared && npm run dev
```

The root `npm run dev` already handles this — it builds shared before starting server and client. Re-run after pulling changes to shared types.

---

## 2. Vite tsconfig Warning — Cannot Find Base Config

**Symptoms**

```
[vite:tsconfig-paths] Cannot find base config "@appydave/appystack-config/typescript/react.json"
```

Build succeeds despite the warning.

**Cause**

Vite's internal tsconfig path resolver does not use Node module resolution. The warning is cosmetic — `tsc` resolves and applies the config correctly.

**Fix**

No action required. Confirm TypeScript works: `npm run typecheck`

---

## 3. Port Conflicts — Orphaned Processes From a Previous Dev Session

> **As of 2026-03-10** the template has three defences built in. If you're hitting this, something bypassed those defences — read on.

**What the template now does automatically**

1. **`strictPort: true`** in `client/vite.config.ts` — Vite fails immediately with a clear error instead of silently bumping to the next port
2. **`cleanupPort()`** in `server/src/index.ts` — the Express server kills any process holding its port before binding
3. **`--kill-others`** in the root `dev` script — all children (Vite, nodemon) die when any one exits, including on Ctrl+C

**Symptoms if still occurring**

```
Error: listen EADDRINUSE: address already in use :::5501
Error: Port 5500 is already in use
```

**Cause**

A previous dev session left orphaned processes. The `cleanupPort()` ran but something held on (e.g. the port is used by a completely different app).

**Fix — Kill manually**

```bash
kill -9 $(lsof -ti tcp:5500)
kill -9 $(lsof -ti tcp:5501)
```

**Fix — Change ports (three files must stay in sync)**

`template/.env`:
```bash
PORT=5601
CLIENT_URL=http://localhost:5600
```

`template/client/vite.config.ts`:
```typescript
server: {
  port: 5600,
  strictPort: true,
  proxy: {
    '/api':       { target: 'http://localhost:5601', changeOrigin: true },
    '/health':    { target: 'http://localhost:5601', changeOrigin: true },
    '/socket.io': { target: 'http://localhost:5601', changeOrigin: true, ws: true },
  },
},
```

`template/server/src/config/env.ts`:
```typescript
PORT: z.coerce.number().default(5601),
CLIENT_URL: z.string().default('http://localhost:5600'),
```

**Ongoing tracking**

Port conflict patterns across all AppyDave apps are tracked in the pain doc:
`~/dev/ad/brains/brand-dave/dev-pain-port-conflicts.md`

See `docs/architecture.md` for the full port allocation table.

---

## 4. ESLint Fails Silently — No Errors, No Output

**Symptoms**

`npm run lint` exits cleanly with no output even when code has obvious violations.

**Cause**

ESLint 9 silently ignores all legacy `.eslintrc.*` files. A leftover legacy config alongside `eslint.config.js` can cause ESLint to apply no rules.

**Fix**

```bash
find template -name ".eslintrc*" -not -path "*/node_modules/*"
```

Remove any files found. The only ESLint config should be `template/eslint.config.js`:

```javascript
import appyConfig from '@appydave/appystack-config/eslint/react';
export default [...appyConfig];
```

Verify rules are loading — the output should include `typescript-eslint` rules:

```bash
cd template && npx eslint --print-config client/src/main.tsx
```

ESLint 9 does not support `--ext`; file extensions are controlled by the config's `files` globs.

---

## 5. Socket.io Won't Connect — CORS Error

**Symptoms**

```
Access to XMLHttpRequest at 'http://localhost:5501/socket.io/...' from origin
'http://localhost:5500' has been blocked by CORS policy
```

**Cause**

The server sets Socket.io CORS `origin` from `env.CLIENT_URL` in `template/server/src/config/env.ts`. If `.env` is missing or `CLIENT_URL` does not exactly match the browser origin, Socket.io rejects the handshake.

**Fix**

Verify `template/.env` has the correct `CLIENT_URL`:

```bash
cat template/.env
# CLIENT_URL=http://localhost:5500
```

If `.env` is missing: `cp template/.env.example template/.env`

Also confirm `template/client/vite.config.ts` includes `ws: true` on the Socket.io proxy entry — without it the WebSocket upgrade fails and connections silently fall back to polling then disconnect.

---

## 6. Husky Hooks Not Running

**Symptoms**

`git commit` completes without triggering lint-staged. Running `husky init` inside `template/` has no effect.

**Cause**

Husky attaches to the repo root `.git/` directory. The `template/` subdirectory has no `.git/`, so any Husky setup run from there creates an orphaned `.husky/` that Git never reads.

**Fix**

Run from the AppyStack repo root, not from `template/`:

```bash
# /Users/davidcruwys/dev/ad/apps/appystack/
npm run prepare

# Verify hooks exist
ls /Users/davidcruwys/dev/ad/apps/appystack/.husky/
```

---

## 7. npm Install Fails — Peer Dependency Errors

**Symptoms**

```
npm error ERESOLVE unable to resolve dependency tree
npm error peer dep missing: react@"^18.0.0"
```

**Cause**

npm workspaces hoist all deps to root `node_modules/`. Version conflicts between workspaces or strict peer ranges in third-party packages cause the resolver to fail.

**Fix**

```bash
# Option 1 — legacy resolver
npm install --legacy-peer-deps

# Option 2 — clean reinstall
npm run clean && npm install && npm run build -w shared
```

Verify workspace links resolved correctly:

```bash
npm ls @appystack-template/shared
```

---

## 8. Prettier Formats Differently Than Expected

**Symptoms**

`npm run format:check` fails for files that appear correct. Two developers see different formatting on the same file.

**Cause**

Prettier resolves the nearest config. Conflicts arise from: editor using its own settings, a `.prettierrc` in a parent directory taking precedence, or generated files missing from `.prettierignore`.

**Fix**

Identify the active config:

```bash
cd template && npx prettier --find-config-path src/index.ts
# Should reference @appydave/appystack-config/prettier
```

Ensure VS Code uses the project Prettier (`.vscode/` is included in the template), then run:

```bash
npm run format:check   # dry run
npm run format         # apply
```

---

## 9. Tests Fail on CI but Pass Locally

**Symptoms**

`npm test` passes locally. The CI job in `template/.github/workflows/ci.yml` reports failures.

**Cause — NODE_ENV differences**

CI runs with `NODE_ENV=test`. Locally it may be unset. Code branching on `NODE_ENV` in `template/server/src/config/env.ts` behaves differently.

```bash
# Reproduce CI locally
NODE_ENV=test npm test
```

**Cause — Missing Playwright browsers**

`template/e2e/` tests require browser binaries not pre-installed on `ubuntu-latest`. Add a step before e2e tests:

```bash
npx playwright install --with-deps chromium
npx playwright test
```

**Cause — EADDRINUSE in parallel test files**

Multiple test files importing `template/server/src/index.ts` trigger multiple `listen()` calls unless the guard is in place:

```typescript
// template/server/src/index.ts
if (!env.isTest) {
  httpServer.listen(env.PORT, () => { ... });
}
```

---

## 10. Coverage Below Threshold

**Symptoms**

```
ERROR: Coverage for lines (72%) does not meet global threshold (80%)
```

**Cause**

New code added without tests, or untestable files included in the report.

**Fix — Find low-coverage files**

```bash
npm run test:coverage -w server && open template/server/coverage/index.html
npm run test:coverage -w client && open template/client/coverage/index.html
```

**Fix — Exclude files**

Add a c8 comment to generated or trivial files:

```typescript
/* c8 ignore file */
```

Or configure exclusions in the workspace `vitest.config.ts`:

```typescript
coverage: {
  exclude: ['src/types/**', 'src/generated/**'],
},
```

Lower thresholds temporarily while adding tests, then restore to 80%+:

```typescript
coverage: {
  thresholds: { lines: 75, branches: 70 },
},
```

---

## 11. Server Starts on Wrong Port — UI Stuck on "Loading..."

> **Found 2026-03-17** during digital-stage-summit-2026 development. Wasted ~1 hour before root cause identified. Fix is now in the template.

**Symptoms**

- `start.sh` banner says `server: http://localhost:5071`
- Server logs say `Server running on http://localhost:5171` (or some other port)
- Browser shows "Loading..." indefinitely — never loads data
- No error in the UI — just spins forever
- Restarting via `./scripts/start.sh` loops: kills client port, leaves server on wrong port, Overmind conflicts

**Root cause — two compounding bugs**

**Bug 1: `dotenv` never found the `.env` file**

When npm workspaces runs `npm run dev -w server`, it changes `process.cwd()` to the `server/` workspace directory. `dotenv.config()` with no path argument looks for `.env` relative to `cwd` — which is `server/`, not the monorepo root. It finds nothing and silently continues with `process.env` as-is.

**Bug 2: `dotenv` doesn't override inherited shell variables**

By default, `dotenv` never overwrites a `process.env` value that is already set. If a prior Overmind or tmux session left `PORT=5171` in the environment (from a different app, a crashed session, or any stray export), the new server process inherits it and `.env` has zero effect — even if Bug 1 is fixed.

**Result:** Client's `VITE_SOCKET_URL=http://localhost:5071` points at nothing. Server is on 5171. Socket.io never connects. The `useSocket` hook never errors — it just hangs. Every view waiting on socket data shows "Loading..." forever with no user-visible error.

**Fix — already applied to template (as of 2026-03-17)**

`server/src/config/env.ts`:
```typescript
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fix 1: resolve .env from monorepo root, not process.cwd()
// Fix 2: override: true ensures .env wins over any inherited shell/tmux PORT variable
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });
```

`scripts/start.sh` — before `overmind start`:
```bash
# Prevent stale PORT from shell bleeding into child processes
unset PORT
```

**Fix — if you're hitting this on an older project**

1. Apply the two-line fix to `server/src/config/env.ts` above
2. Add `unset PORT` to `scripts/start.sh` before the `overmind start` call
3. Run `./scripts/start.sh` — it will now self-recover

**Why `start.sh` made it worse**

The script checked for a process on `$SERVER_PORT` (5071 from `.env`). The rogue server was on 5171 — so the check found nothing. It killed Vite (5070), then called `overmind start` on top of an existing session. `.overmind.sock` still existed, Overmind conflicted, and the user was stuck in a kill-restart loop. The script now does a full `overmind stop` + `rm -f .overmind.sock` before anything else.

**How to detect it quickly next time**

```bash
# Check what port the server process is actually on
ps aux | grep "tsx src/index" | grep -v grep
# Then:
lsof -i :<pid_port> | grep LISTEN
# Or just check all relevant ports:
netstat -an | grep LISTEN | grep "507\|516\|517"
```

If the port in the log doesn't match `.env PORT=`, this bug is the cause.

---

## Related Documentation

- `docs/architecture.md` — Architecture guide, port allocation, config inheritance
- `docs/requirements.md` — Setup checklist and dependency matrix
- `template/CLAUDE.md` — Template commands and patterns
- `~/dev/ad/brains/brand-dave/dev-pain-port-conflicts.md` — Cross-app port conflict pain tracker (ongoing)
