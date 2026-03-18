# BACKLOG.md

Tracked improvement ideas and deferred decisions for AppyStack. Not a sprint — just a place to capture things worth revisiting before they get lost.

---

## Wave 5 Candidates

### Bugs — startup / environment loading (found 2026-03-17, repro: digital-stage-summit-2026)

- **`dotenv.config()` silently fails — server starts on wrong port** — This is a critical startup bug that breaks every generated app. Two compounding causes: (1) When Overmind launches the server via `npm run dev -w server`, npm workspaces change `process.cwd()` to `server/`. `dotenv.config()` with no `path` argument never finds the root `.env`. (2) Even when the path is fixed, `dotenv` does NOT override existing `process.env` values by default. If a prior Overmind/tmux session left `PORT=5171` (or any stray value) in the environment, the new server process inherits it silently and `.env` has no effect. The client's `VITE_SOCKET_URL` points to 5071, server runs on 5171 — Socket.io never connects — UI stuck on "Loading..." forever, no error shown.
  **Fix (already applied to digital-stage-summit-2026, must be backported to template):**
  ```ts
  // server/src/config/env.ts — two fixes in one line:
  dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });
  ```
  Plus in `start.sh`, add `unset PORT` before `overmind start` to clear any stale shell value.
  **Required test:** set `PORT=9999` in shell before starting, assert server runs on the port from `.env` not 9999.
  **Fix (already applied to digital-stage-summit-2026, must be backported to template):**
  ```ts
  // server/src/config/env.ts
  import { fileURLToPath } from 'node:url';
  import { dirname, resolve } from 'node:path';
  import path from 'node:path';
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  // server/src/config/ is 3 levels below monorepo root
  ```
  **Required test:** scaffold with non-default ports (e.g. 5080/5081), start via `npm run dev -w server` from project root, assert `env.PORT === 5081` (not the schema default).

- **`start.sh` does not self-recover — requires manual `overmind stop` + re-run** — `start.sh` only checks for processes on the port numbers listed in `.env`. If the server started on a different port (e.g. due to the dotenv bug above), `start.sh` sees nothing on the expected port, kills Vite, then tries to run `overmind start` on top of an already-running Overmind session. `.overmind.sock` still exists, Overmind errors, the client is dead, the old server is still on the wrong port. The user is stuck in a "kill it? y → fails again" loop. Running `overmind stop` manually produces `dial unix ./.overmind.sock: connect: no such file or directory` if the sock is already stale, adding to the confusion.
  **Fix (already applied to digital-stage-summit-2026, must be backported to template):** `start.sh` should always: (1) check for `.overmind.sock` and run `overmind stop` + `rm -f .overmind.sock` silently before doing anything else; (2) kill anything on both the server port AND the client port unconditionally (no prompts); (3) never ask the user to decide — just clean up and proceed. The interactive "Kill it? [y/N]" prompt is the source of confusion and should be removed entirely from the default flow.

- **No signal when Socket.io fails to connect — UI stuck on "Loading..." indefinitely** — If the server is unreachable (wrong port, not started, stale sock), `useSocket` never errors. Any view waiting on socket data just shows "Loading..." with no timeout, no retry indicator, no error message. The user has no UI signal that the problem is server-side.
  **Fix (two parts):** (1) `useSocket` should emit a connection error event after N seconds and expose `connectionError` state. (2) Views should show a "Cannot reach server — check that the dev server is running on port X" message after timeout, not spin forever.

- **Vite duplicate style key warnings on startup** — The generated `SidebarGroup.tsx` has `borderLeft` declared twice in the same style object (once before `border: 'none'`, once after). Vite/esbuild flags this as a warning on every startup, adding noise that masks real warnings. Fix: ensure `border: 'none'` comes first, then a single `borderLeft`. Template needs cleanup before next publish.

### Bugs — create-appystack CLI (found 2026-03-17)

- **`VITE_SOCKET_URL` not replaced during scaffolding** — `applyCustomizations` in `create-appystack/bin/index.js` replaces `PORT` and `CLIENT_URL` in `.env.example` but misses `VITE_SOCKET_URL=http://localhost:5501`. Every generated project has the wrong socket URL. Fix: add `replaceAll` for `VITE_SOCKET_URL` line. Needs test: scaffold with non-default ports, assert `.env.example` has correct `VITE_SOCKET_URL`.

- **`.env` not auto-created from `.env.example`** — `scripts/start.sh` fails immediately if `.env` doesn't exist. The CLI copies `.env.example` but never creates `.env`. Developer has no signal to do this. Fix options: (a) CLI creates `.env` from `.env.example` automatically after scaffold, or (b) `start.sh` auto-copies `.env.example` → `.env` on first run with a visible notice. Needs decision + test.

- **Git step false negative — `appystack.json` not written** — CLI reports "Git step skipped" even when `git commit` succeeds (confirmed: commit exists in log). Because `gitResult.ok` is falsely `false`, `appystack.json` is never written — breaking `npx appystack-upgrade` baseline tracking. Root cause of the false negative needs investigation (likely `execSync` exit code mismatch). Needs test: verify `appystack.json` is written after successful scaffold.

- **`getting-started.md` out of date** — Describes Option A (GitHub template) and Option B (`degit`) only. Does not mention `create-appystack`. First-run process shown is `npm run build && npm run dev`; actual process is `./scripts/start.sh` (Overmind). Update docs to: (1) add `create-appystack` as the primary option, (2) correct first-run steps to `cp .env.example .env && ./scripts/start.sh`.



### Docs
- **docs/README.md navigation** — Add task-based navigation ("I want to add a Socket.io event" → socket-io.md + api-design.md) and priority grouping ("Start here")
- **template/README.md** — Expand into a "welcome to your new project" guide. Currently thin. Should explain the demo/ folder, customization TODO markers, and first steps after cloning.

### Architecture Decisions (Open)
- **ShadCN/Radix question** — Template currently uses plain TailwindCSS. Decide: stay minimal, or add ShadCN as the default component library? Would affect template structure, dependencies, and the `cn()` utility already in place.

### Test Coverage Gaps
- **Component render tests** — `StatusGrid`, `TechStackDisplay`, `SocketDemo` in `client/src/demo/` have 35–50% branch coverage. No render tests exist. Adding tests for these before they're used as reference code would improve confidence.
- **E2E error scenarios** — Current E2E tests cover happy paths only. Missing: server-down (500), rate limiting (429), validation errors, Socket.io reconnection.
- **Middleware coverage** — Helmet security headers, compression, and CORS behaviour are untested. These are important for production apps built on the template.

### Config Package
- **Refactor check** — Confirm `react.config.js` extending `base.config.js` (done in review) hasn't introduced any edge case for projects that only use the react config entry point.
- **Version bump** — After any config changes, publish as `v1.0.4`.

---

## Deferred / Parked

- **Feature-based folder structure** — Some consumer apps may prefer `features/` over `components/pages/hooks/`. A guide or variant would be useful but is out of scope for the base template.
- **Authentication pattern** — JWT / session-based auth is a common first extension. A Wave N WU could add a commented auth scaffold (commented out by default).
- **Database integration guide** — Prisma or Drizzle as a first-class pattern. Not in scope until the base template is more stable.

---

*Last updated: 2026-02-27*
