# AppyStack Boilerplate Template — Implementation Plan

## Context

AppyStack has shared configs (`config/`) and docs (`docs/`) but no reference application. This plan creates a `template/` directory containing a complete RVETS stack boilerplate (React, Vite, Express, TypeScript, Socket.io) that demonstrates how to consume the shared configs and serves as a starting point for new projects.

**The problem**: Starting a new RVETS project means wiring up ~36 files across 3 workspaces with quality tooling that takes 10-14 hours and is error-prone (FliGen post-mortem: 3/5 tools broken on first attempt). This template eliminates that.

**What you see when you run `npm run dev`**: A dark-themed page with this retro Figlet ASCII art banner in terminal green:

```
     _                      ____  _             _
    / \   _ __  _ __  _   _/ ___|| |_ __ _  ___| | __
   / _ \ | '_ \| '_ \| | | \___ \| __/ _` |/ __| |/ /
  / ___ \| |_) | |_) | |_| |___) | || (_| | (__|   <
 /_/   \_\ .__/| .__/ \__, |____/ \__\__,_|\___|_|\_\
         |_|   |_|    |___/
```

Below that, a clean modern status grid with live green/red indicators proving each subsystem works — API health fetched via proxy, Socket.io connection status, environment info (NODE_ENV, ports, Node version), and uptime. Below the status grid, a static 4-category tech stack listing (Client, Server, Cross-cutting, Testing & Quality). The page itself is the verification checklist — if everything is green, the template is working correctly.

---

## Key Decisions

- **Location**: `template/` inside this repo (alongside `config/` and `docs/`)
- **Name**: `@appydave/appystack-template`, ports 5500/5501
- **Config**: Imports use `@appydave/appystack-config/...` paths; `devDependencies` uses `file:../config` temporarily with TODO comment for npm publish
- **Placeholder markers**: TODO comments at every project-specific value (name, ports, branding)

---

## Phase 1: Root Scaffolding (6 files)

Create `template/` with root workspace configuration.

| File | Purpose |
|------|---------|
| `package.json` | Workspaces config, all scripts, devDeps incl. `@appydave/appystack-config` |
| `eslint.config.js` | Imports from `@appydave/appystack-config/eslint/react` |
| `.prettierrc` | Standard formatting rules (single quotes, semi, 100 width) |
| `.prettierignore` | dist, build, node_modules, coverage, package-lock.json |
| `.gitignore` | Standard Node ignores + .env |
| `.env.example` | NODE_ENV, PORT=5501, CLIENT_URL=http://localhost:5500 |

**Verify**: `npm install` succeeds

## Phase 2: Shared Package (4 files)

Create `template/shared/` — leaf package with no dependencies on client/server.

| File | Purpose |
|------|---------|
| `shared/package.json` | `@appystack-template/shared`, build/typecheck scripts |
| `shared/tsconfig.json` | Extends `@appydave/appystack-config/typescript/base`, outDir/rootDir/declaration |
| `shared/src/types.ts` | ApiResponse, HealthResponse, ServerInfo, SocketEvents interfaces |
| `shared/src/index.ts` | Re-exports from types.ts |

**Verify**: `npm run build -w shared` and `npm run typecheck -w shared`

## Phase 3: Server (11 files)

Create `template/server/` — Express 5 + Socket.io + Zod + Pino.

| File | Purpose |
|------|---------|
| `server/package.json` | Deps: express, socket.io, pino, zod, helmet, compression, cors, dotenv. DevDeps: vitest, supertest, tsx, nodemon, typescript |
| `server/tsconfig.json` | Extends `@appydave/appystack-config/typescript/node` |
| `server/vitest.config.ts` | Node environment, globals, 10s timeouts |
| `server/nodemon.json` | Watch src/, exec tsx |
| `server/src/config/env.ts` | Zod schema: NODE_ENV, PORT(5501), CLIENT_URL. Exports typed `env` with isDevelopment/isProduction/isTest |
| `server/src/config/logger.ts` | Pino logger: pino-pretty in dev, JSON in prod |
| `server/src/middleware/requestLogger.ts` | pino-http with UUID request IDs, status-based log levels |
| `server/src/routes/health.ts` | `GET /health` -> `{status:"ok", timestamp}` (minimal, production-safe) |
| `server/src/routes/info.ts` | `GET /api/info` -> `{nodeVersion, environment, port, clientUrl, uptime}` (rich data for template page) |
| `server/src/index.ts` | Express app + httpServer + Socket.io. Middleware: helmet, compression, cors, json, requestLogger. Mounts health + info routes. Socket events: client:ping/server:message. Graceful shutdown |
| `server/src/test/health.test.ts` | Supertest: tests for both /health and /api/info endpoints |

**Verify**: `npm run typecheck -w server`, `npm test -w server`, `curl localhost:5501/health`, `curl localhost:5501/api/info`

## Phase 4: Client (15 files)

Create `template/client/` — React 19 + Vite 6 + TailwindCSS v4.

### Visual design

The page has two distinct zones:

**Hero zone (retro terminal)**: Dark background, Figlet-style ASCII art of "AppyStack" in a `<pre>` tag with green monospace text (`font-family: monospace; color: #22c55e`). Brief tagline below in the same terminal style. This section feels like booting a system.

**Body zone (modern cards)**: Transitions to clean Tailwind slate/blue palette with rounded cards.

- **Status grid**: 2x2 card grid, each card shows a subsystem with a green/red dot indicator:
  - **API Health** — fetches `GET /health` via Vite proxy, shows status + timestamp
  - **WebSocket** — Socket.io connection indicator (connected/disconnected)
  - **Environment** — fetches `GET /api/info`, shows NODE_ENV + port config
  - **Runtime** — from same /api/info response: Node version + uptime
- **Tech stack**: 4-category grid (Client, Server, Cross-cutting, Testing & Quality) with static data array — name, version, one-line description per technology

| File | Purpose |
|------|---------|
| `client/package.json` | Deps: react, react-dom, socket.io-client. DevDeps: vite, @vitejs/plugin-react, tailwindcss, @tailwindcss/vite, vitest, testing-library, jsdom, typescript |
| `client/tsconfig.json` | Extends `@appydave/appystack-config/typescript/react` |
| `client/vite.config.ts` | Port 5500, proxy /api and /socket.io to localhost:5501 |
| `client/vitest.config.ts` | jsdom environment, setup file, react plugin |
| `client/index.html` | HTML shell, no Google Fonts dependency (pure monospace for ASCII art) |
| `client/src/main.tsx` | ReactDOM.createRoot, StrictMode, CSS import |
| `client/src/App.tsx` | Renders LandingPage |
| `client/src/vite-env.d.ts` | Vite client types reference |
| `client/src/styles/index.css` | TailwindCSS v4: `@import "tailwindcss"`, `@source`, CSS variables. Terminal green + dark slate palette |
| `client/src/hooks/useSocket.ts` | Socket.io hook returning {socket, connected} |
| `client/src/hooks/useServerStatus.ts` | Fetches /health and /api/info on mount, returns status + data + loading/error states |
| `client/src/components/StatusGrid.tsx` | 2x2 grid of status cards with green/red indicators. Consumes useServerStatus + useSocket |
| `client/src/components/TechStackDisplay.tsx` | 4-category grid with static data array (Client, Server, Cross-cutting, Testing & Quality) |
| `client/src/pages/LandingPage.tsx` | ASCII banner hero (retro zone), then StatusGrid + TechStackDisplay (modern zone) |
| `client/src/test/setup.ts` | `import '@testing-library/jest-dom'` |
| `client/src/test/App.test.tsx` | Renders title, displays status grid, displays tech stack section |

**Verify**: `npm run typecheck -w client`, `npm test -w client`, open http://localhost:5500

## Phase 5: CI/CD (1 file)

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | On push/PR to main: npm ci, lint, format:check, build, test. Node 20.x, npm cache, concurrency groups |

**Verify**: Run all CI commands locally in sequence

## Phase 6: Documentation (2 files)

| File | Purpose |
|------|---------|
| `README.md` | Quick start, features, scripts reference, customization guide, port config |
| `CLAUDE.md` | AI agent context: architecture, commands, patterns, customization TODO markers |

---

## What You Experience

1. **Run `npm run dev`** — both servers start (blue/green console output via concurrently)
2. **Open http://localhost:5500** — page loads with:
   - Retro green ASCII art banner saying "AppyStack" on dark background
   - Brief tagline: "Production-ready RVETS stack boilerplate"
   - Status grid with 4 cards, each showing a live green dot:
     - API Health: "ok" with timestamp (proves Express + Vite proxy work)
     - WebSocket: "connected" (proves Socket.io works)
     - Environment: "development" on port 5501 (proves Zod config loaded)
     - Runtime: Node version + uptime (proves server is responsive)
   - Tech stack in 4 categorized columns below
3. **If something is broken** — the relevant card shows a red dot with an error message instead
4. **To start your own project** — copy `template/`, search for TODO, rename, change ports, delete the landing page content and start building

---

## Final Verification

```bash
cd /Users/davidcruwys/dev/ad/apps/appystack/template
npm install
npm run format
npm run lint
npm run format:check
npm run build
npm test
npm run test:coverage
npm run dev
# Browser: http://localhost:5500 — ASCII banner + all 4 status cards green
# curl http://localhost:5501/health — {"status":"ok","timestamp":"..."}
# curl http://localhost:5501/api/info — {"nodeVersion":"...","environment":"development",...}
```

**Total**: ~39 files across 6 phases, executed in strict sequence.
