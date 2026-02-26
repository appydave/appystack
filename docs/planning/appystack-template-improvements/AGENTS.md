# AGENTS.md - AppyStack Template Improvement Campaign

## What This Is

Operational knowledge for a Ralph Wiggum Task Agent campaign. Each agent receives this file + a specific work unit.

**Worktree**: `/Users/davidcruwys/dev/ad/apps/appystack/.worktrees/appystack-template-improvements`
**Template**: `/Users/davidcruwys/dev/ad/apps/appystack/.worktrees/appystack-template-improvements/template/`

## Build & Run

```bash
cd /Users/davidcruwys/dev/ad/apps/appystack/.worktrees/appystack-template-improvements/template

# Install
npm install

# Dev (both servers)
npm run dev

# Build (order matters: shared -> server -> client)
npm run build

# Individual workspace commands
npm run build -w shared
npm run build -w server
npm run build -w client
```

## Validation (run after EVERY change)

```bash
cd /Users/davidcruwys/dev/ad/apps/appystack/.worktrees/appystack-template-improvements/template

# All four must pass before committing
npm run format:check
npm run lint
npm run build
npm test

# Format fix if needed
npm run format
```

## Quality Gates

- All four validation commands pass
- TypeScript compiles without errors (`npm run build`)
- All tests pass (`npm test`)
- No `any` types introduced (warn is ok for existing)
- Co-located test files: `ComponentName.test.tsx` next to `ComponentName.tsx`
- Server tests: `routeName.test.ts` next to `routeName.ts`
- NO mocks of hooks or fetch — test against real lightweight servers (Supertest)
- Commit with descriptive message after each successful work unit

## Project Structure

```
template/
  package.json              # Root workspace config
  eslint.config.js          # Inlined ESLint (TODO: import after npm publish)
  .prettierrc / .prettierignore / .gitignore / .env.example
  shared/
    package.json
    tsconfig.json
    src/
      types.ts              # ApiResponse, HealthResponse, ServerInfo, SocketEvents
      index.ts              # Re-exports
  server/
    package.json
    tsconfig.json
    vitest.config.ts
    nodemon.json
    src/
      index.ts              # Express + Socket.io app
      config/env.ts          # Zod env validation
      config/logger.ts       # Pino logger
      middleware/requestLogger.ts
      routes/health.ts       # GET /health
      routes/info.ts         # GET /api/info
      test/health.test.ts    # Current tests (will be moved to co-located)
  client/
    package.json
    tsconfig.json
    vite.config.ts
    vitest.config.ts
    index.html
    src/
      main.tsx / App.tsx / vite-env.d.ts
      styles/index.css
      hooks/useSocket.ts / useServerStatus.ts
      components/StatusGrid.tsx / TechStackDisplay.tsx
      pages/LandingPage.tsx
      test/setup.ts / App.test.tsx  # Current tests (will be moved)
```

## Coding Patterns

### TypeScript — Strict, no shortcuts
- `strict: true` across all packages
- Use `import type` for type-only imports
- No `any` — use `unknown` and narrow

### Express Routes — Router pattern
```typescript
import { Router } from 'express';
const router = Router();
router.get('/path', (req, res) => { ... });
export default router;
```

### React Components — Function components, named exports for pages
```typescript
// Components: default export
export default function StatusGrid() { ... }
// Pages: default export
export default function LandingPage() { ... }
```

### Imports — Use .js extensions for ESM
```typescript
import { env } from './config/env.js';
import type { ApiResponse } from '@appystack-template/shared';
```

### CSS — TailwindCSS v4 syntax
```css
@import 'tailwindcss';
@source "../";
```

## Reference Patterns for This Campaign

### Socket.io Typed Events (MUST follow this pattern)
```typescript
// shared/src/types.ts — Split into TWO interfaces
export interface ServerToClientEvents {
  'server:pong': (data: { message: string; timestamp: string }) => void;
}

export interface ClientToServerEvents {
  'client:ping': () => void;
}

// server/src/index.ts — Pass generics
import { Server } from 'socket.io';
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, { ... });

// client/src/hooks/useSocket.ts — Pass generics
import { Socket, io } from 'socket.io-client';
type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
```

### Global Express Error Handler (~40 lines)
```typescript
// server/src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const isOperational = err instanceof AppError ? err.isOperational : false;

  logger.error({ err, statusCode, isOperational }, err.message);

  res.status(statusCode).json({
    status: 'error',
    error: isOperational ? err.message : 'Internal server error',
    timestamp: new Date().toISOString(),
  });
}
```

### Zod Request Validation Middleware (~20 lines)
```typescript
// server/src/middleware/validate.ts
import { z, ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export function validate(schema: { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType }) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.query) req.query = schema.query.parse(req.query);
      if (schema.params) req.params = schema.params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ status: 'error', error: err.errors, timestamp: new Date().toISOString() });
        return;
      }
      next(err);
    }
  };
}
```

### React Error Boundary
```bash
# Install in client
npm install react-error-boundary -w client
```
```typescript
// client/src/components/ErrorFallback.tsx
import type { FallbackProps } from 'react-error-boundary';

export default function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="p-6 bg-red-900/20 border border-red-500 rounded-lg text-center">
      <h2 className="text-red-400 text-lg font-bold mb-2">Something went wrong</h2>
      <pre className="text-red-300 text-sm mb-4">{error.message}</pre>
      <button onClick={resetErrorBoundary} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500">
        Try again
      </button>
    </div>
  );
}
```

### Unit Testing — NO MOCKS, real servers
```typescript
// Server route test pattern (co-located)
// server/src/routes/health.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import healthRouter from './health.js';

const app = express();
app.use(healthRouter);

describe('GET /health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
```

```typescript
// Client hook test pattern — real server, no mocks
// client/src/hooks/useServerStatus.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import express from 'express';
import type { Server } from 'node:http';
import { useServerStatus } from './useServerStatus.js';

let server: Server;

beforeAll(() => {
  const app = express();
  app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
  app.get('/api/info', (_, res) => res.json({ status: 'ok', data: { nodeVersion: 'test', environment: 'test', port: 0, clientUrl: '', uptime: 0 } }));
  server = app.listen(0); // Random port
});

afterAll(() => server?.close());

describe('useServerStatus', () => {
  it('fetches health and info', async () => {
    const { result } = renderHook(() => useServerStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.health?.status).toBe('ok');
  });
});
```

### Rate Limiting
```typescript
// server/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
```

## Anti-Patterns — DO NOT DO THESE

- **NO vi.mock() for hooks** — Test hooks against real lightweight servers, not mocks
- **NO vi.mock() for fetch** — Use real HTTP calls in tests (Supertest or real server on port 0)
- **NO jest.fn()** — This project uses Vitest. Use `vi.fn()`
- **NO centralized test/ directories** — Co-locate: `Component.test.tsx` next to `Component.tsx`
- **NO relative imports like ../../../../** — Use `@appystack-template/shared` or relative from current dir
- **NO TailwindCSS v3 syntax** — Use `@import 'tailwindcss'`, NOT `@tailwind base`
- **NO .eslintrc files** — ESLint 9 flat config only (`eslint.config.js`)
- **NO adding dependencies without checking versions** — Run `npm view <pkg> version` first
- **NO combined SocketEvents interface** — Must split into `ServerToClientEvents` + `ClientToServerEvents`

## Work Units (Pattern 2: Diverse Improvements)

Each work unit has three fields:
- **What**: The specific changes to make
- **Why**: The problem this solves
- **Done when**: Verifiable completion criteria (the agent checks these before reporting back)

---

### Phase 1: Foundation Fixes

#### WU-1: Dependency cleanup — COMPLETE
- Already done before campaign started. formidable removed, phantom deps audited.

#### WU-2: Shared package — split types + add constants
- **What**: Split `SocketEvents` interface into `ServerToClientEvents` and `ClientToServerEvents` (see Reference Patterns above). Add `shared/src/constants.ts` with `ROUTES` object (all API paths) and `SOCKET_EVENTS` object (all event names). Update `shared/src/index.ts` to export the new types and constants. Update server and client imports to use the split types (don't wire generics yet — that's WU-5).
- **Why**: Socket.io v4 requires separate interfaces for type-safe events. Constants prevent magic strings scattered across client and server.
- **Done when**: `npm run build -w shared` passes. `npm run build` (full) passes. `SocketEvents` no longer exists. `ServerToClientEvents`, `ClientToServerEvents`, `ROUTES`, and `SOCKET_EVENTS` are exported from shared. Server and client still compile.

#### WU-3: Error handling — server
- **What**: Add `server/src/middleware/errorHandler.ts` with AppError class (~12 lines) and errorHandler middleware (~25 lines). Add `server/src/middleware/validate.ts` with Zod request validation (~20 lines). Add `server/src/helpers/response.ts` with `apiSuccess()` and `apiFailure()` helper functions (~15 lines). Wire error handler into `server/src/index.ts` AFTER all routes. Add a 404 catch-all handler before the error handler.
- **Why**: No global error handler means unhandled errors crash the server silently. No validation middleware means request bodies are trusted blindly. Express 5 auto-propagates async errors, so the handler catches everything.
- **Done when**: `npm run build -w server` passes. Hitting a nonexistent route returns `{"status":"error","error":"Not found"}` with 404 status. The error handler is the LAST middleware registered. Existing /health and /api/info routes still work.

#### WU-4: Error handling — client
- **What**: Install `react-error-boundary` in client workspace. Add `client/src/components/ErrorFallback.tsx` (see Reference Patterns). Wrap `<App />` in `<ErrorBoundary>` in `client/src/main.tsx` with the ErrorFallback component.
- **Why**: Unhandled React errors show a white screen with no recovery path. Error boundary catches render errors and shows a styled fallback with a retry button.
- **Done when**: `npm run build -w client` passes. `npm run build` (full) passes. ErrorFallback component exists. main.tsx wraps App in ErrorBoundary. Dev server starts and page loads normally.

---

### Phase 2: Socket.io + Data Fetching

#### WU-5: Socket.io overhaul
- **What**: Add `Server<ClientToServerEvents, ServerToClientEvents>` generics to the Socket.io server constructor in `server/src/index.ts`. Add typed `Socket<ServerToClientEvents, ClientToServerEvents>` to the client `useSocket` hook. Replace magic string event names with `SOCKET_EVENTS` constants from shared. Add `client/src/components/SocketDemo.tsx` — a component with a "Send Ping" button that calls `socket.emit('client:ping')` and displays the server's pong response with timestamp. Integrate SocketDemo into the StatusGrid or LandingPage.
- **Why**: The current Socket.io implementation is misleading — server defines events but client never uses them. The `SocketEvents` type was unused at runtime. This completes the demo so users can verify bidirectional communication works visually.
- **Done when**: `npm run build` passes. Dev server starts. Clicking "Send Ping" in the browser emits a client:ping event. Server logs the ping and responds with server:pong. Client displays the pong message with timestamp. TypeScript enforces event names at compile time (misspelling an event name causes a type error). No magic strings — all event names come from `SOCKET_EVENTS`.

#### WU-6: Data fetching — AbortController
- **What**: Add AbortController to the `useServerStatus` hook's fetch calls. Create the controller in useEffect, pass `signal` to both fetch calls, abort in the cleanup function. Add a 10-second timeout using `AbortSignal.timeout(10000)` combined with the cleanup signal.
- **Why**: Bare fetch() with no cleanup can leak requests on unmount and hang indefinitely on slow networks.
- **Done when**: `npm run build -w client` passes. The useServerStatus hook creates an AbortController. Both fetch calls receive the signal. The useEffect cleanup function calls `controller.abort()`. Timeout is configured. No behavior change when the server is running normally.

---

### Phase 3: Security + DX

#### WU-7: Security — rate limiting
- **What**: Install `express-rate-limit` in server workspace. Add `server/src/middleware/rateLimiter.ts` with sensible defaults (100 req/15min, draft-8 headers). Wire `apiLimiter` into `server/src/index.ts` before routes. Add a TODO comment in the Socket.io connection handler showing where auth middleware would go (`// TODO: Add socket.handshake.auth.token verification here`).
- **Why**: No rate limiting means health and info endpoints are vulnerable to abuse. The Socket.io auth TODO documents the pattern without requiring a user system.
- **Done when**: `npm run build -w server` passes. Rate limiter is applied before routes in middleware chain. Sending >100 requests in 15 minutes to /health returns 429. Socket.io connection handler has a TODO comment about auth.

#### WU-8: Git hooks
- **What**: Install `husky` and `lint-staged` as root devDependencies. Run `npx husky init`. Configure `.husky/pre-commit` to run `npx lint-staged`. Add `lint-staged` config to root `package.json`: run prettier --write on staged `*.{ts,tsx,js,json,css,md}` files and eslint --fix on staged `*.{ts,tsx,js}` files.
- **Why**: Without pre-commit hooks, developers can commit unformatted/unlinted code that fails CI.
- **Done when**: `npm run build` passes. `.husky/pre-commit` exists and runs lint-staged. `lint-staged` config is in root package.json. Committing an unformatted .ts file auto-formats it before the commit completes.

#### WU-9: VS Code debug configs
- **What**: Add `.vscode/launch.json` with configurations: (1) "Debug Server" using tsx as runtimeExecutable pointing at server/src/index.ts, (2) "Attach to Server" for --inspect mode on port 9229, (3) "Debug Client" launching Chrome at http://localhost:5500, (4) "Debug Current Test" running vitest on the current file. Add a "Full Stack" compound that launches Debug Server + Debug Client together.
- **Why**: No debug configuration means developers fall back to console.log. VS Code launch configs are zero-cost to include and high-value for DX.
- **Done when**: `.vscode/launch.json` exists with 4 configs + 1 compound. File is valid JSON. Each config references correct paths relative to the workspace root.

---

### Phase 4: Test Infrastructure

#### WU-10: Move tests to co-located structure
- **What**: Move `server/src/test/health.test.ts` — split into `server/src/routes/health.test.ts` and `server/src/routes/info.test.ts` (co-located next to the route files). Move `client/src/test/App.test.tsx` to `client/src/App.test.tsx`. Keep `client/src/test/setup.ts` in place (it's a vitest setup file, not a test). Update vitest config `include` patterns if needed to find co-located tests. Delete empty test directories (but keep client/src/test/ if setup.ts is there). Remove any mock-based tests — rewrite to test real behavior.
- **Why**: Co-located tests are easier to find, maintain, and show coverage gaps at a glance. Centralized test/ directories hide which files have tests and which don't.
- **Done when**: `npm test` passes. All test files are next to their source files. No test files in centralized test/ directories (except setup.ts). Same number of tests pass as before (or more, if mocks were replaced with real tests).

#### WU-11: Coverage configuration
- **What**: Install `@vitest/coverage-v8` in both server and client workspaces. Update both vitest configs to add `coverage: { reporter: ['text', 'lcov'], include: ['src/**/*.{ts,tsx}'], exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'] }`. Add commented-out threshold block: `// thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }`. Add `test:coverage` scripts to server and client package.json. Add root `test:coverage` script.
- **Why**: Coverage tooling must be configured before writing tests so developers can see coverage gaps. Commented thresholds show the target without blocking CI until enough tests exist.
- **Done when**: `npm run test:coverage -w server` runs and shows coverage report. `npm run test:coverage -w client` runs and shows coverage report. Coverage includes source files, excludes test files. Threshold lines are present but commented out.

---

### Phase 5: Unit Tests

#### WU-12: Server unit tests — routes + middleware
- **What**: Add co-located tests for: `server/src/config/env.test.ts` (valid env parses, missing required vars fail, defaults apply), `server/src/middleware/errorHandler.test.ts` (AppError returns correct status, unknown errors return 500, isOperational flag works), `server/src/middleware/validate.test.ts` (valid body passes, invalid body returns 400 with Zod errors), `server/src/middleware/rateLimiter.test.ts` (requests under limit pass, requests over limit return 429). All tests use Supertest with isolated Express apps — NO mocks.
- **Why**: Server middleware is the foundation. These tests verify error handling, validation, and rate limiting actually work with real HTTP requests.
- **Done when**: `npm test -w server` passes. Each middleware file has a co-located test file. Tests use Supertest with real Express apps. No vi.mock() calls. Coverage of server middleware files is >80%.

#### WU-13: Server socket tests
- **What**: Add `server/src/socket.test.ts` (or co-located near the socket setup). Test Socket.io event handlers using the official pattern: create a real HTTP server + Socket.io server, connect with `socket.io-client`, emit `client:ping`, verify `server:pong` response with correct payload shape. Test connection and disconnection logging. Use a `waitFor` utility for async assertions.
- **Why**: Socket.io events are currently untested. The official testing pattern uses real connections, not mocks.
- **Done when**: `npm test -w server` passes. Socket test connects a real client to a real server. `client:ping` emission triggers `server:pong` response. Response has `message` and `timestamp` fields. Connection and disconnection are tested. No vi.mock() calls.

#### WU-14: Client hook tests
- **What**: Add `client/src/hooks/useServerStatus.test.ts` — spin up a real lightweight Express app on port 0 in beforeAll, test the hook with renderHook + waitFor, verify it fetches /health and /api/info and sets state correctly. Test error state when server returns 500. Test loading state. Add `client/src/hooks/useSocket.test.ts` — spin up a real Socket.io server on port 0, test the hook connects and sets `connected` to true. NO mocks.
- **Why**: Hooks are currently mocked in component tests, meaning their actual logic (fetch calls, socket connection, state management) is never verified. Testing against real servers catches real bugs.
- **Done when**: `npm test -w client` passes. Both hooks have co-located test files. useServerStatus tests hit a real Express server. useSocket tests connect to a real Socket.io server. No vi.mock() calls. Tests verify both success and error states.

#### WU-15: Client component tests
- **What**: Add co-located tests for: `StatusGrid.test.tsx`, `TechStackDisplay.test.tsx`, `SocketDemo.test.tsx`, `ErrorFallback.test.tsx`, `LandingPage.test.tsx`. For components that use hooks fetching data, either test with real lightweight servers or test the pure rendering with props. ErrorFallback: test that error message renders and reset button calls the callback. TechStackDisplay: test that all 4 categories render. Remove any old mock-based App.test.tsx if it was replaced.
- **Why**: Components need unit tests that verify rendering and interactions. The current tests mock all hooks, hiding potential integration issues.
- **Done when**: `npm test -w client` passes. Each component has a co-located test file. Tests verify rendering, text content, and basic interactions (e.g., ping button click in SocketDemo). No vi.mock() for hooks — use real servers or test pure rendering. Coverage of client components is >70%.

#### WU-16: Playwright smoke test
- **What**: Install `@playwright/test` at root. Add `e2e/smoke.test.ts` at the template root. The test: starts server (port 5501) and client (port 5500) as child processes, waits for both to be ready, navigates to http://localhost:5500, verifies the page title contains "AppyStack", verifies at least one status card is visible, fetches /health directly and verifies 200 response, then kills both processes. Add `test:e2e` script to root package.json.
- **Why**: One E2E smoke test verifies the entire stack works end-to-end. It's a safety net, not a testing strategy — catches integration issues that unit tests miss.
- **Done when**: `npm run test:e2e` passes. Playwright test starts both servers, loads the page, verifies content, and cleans up. Test completes in under 30 seconds. No flakiness (passes 3 consecutive runs).

---

### Phase 6: Production + Polish

#### WU-17: Production deployment
- **What**: Add `Dockerfile` at template root (multi-stage: Node 20 Alpine build stage that runs `npm ci && npm run build`, production stage that copies only built artifacts + node_modules). Add `docker-compose.yml` with the app service + health check. Add `.dockerignore` (node_modules, .git, dist, coverage). In `server/src/index.ts`, add Express static file serving for `../client/dist` gated behind `env.isProduction` with SPA fallback (serve index.html for all non-API routes).
- **Why**: No production deployment guidance means every project using this template has to figure out containerization from scratch. The Dockerfile + static serving gives a complete prod story.
- **Done when**: `npm run build` passes. `docker build -t appystack-template .` succeeds. `docker-compose up` starts the app. In production mode, navigating to http://localhost:5501 serves the client app. /health and /api/info still work. `docker-compose down` cleans up.

#### WU-18: Config package fixes
- **What**: In `../config/package.json`: remove the `"main": "index.js"` field (file doesn't exist). Add `"files": ["eslint/", "typescript/", "vitest/", "prettier/", "README.md"]`. Add `"repository"` field pointing to the GitHub repo. Add `"prepublishOnly": "npm pack --dry-run"` script. Add `peerDependenciesMeta` marking vitest and react plugins as optional. Add `vitest/client.config.ts` export with jsdom environment and `resolve.conditions: ['browser']`.
- **Why**: Config package.json has issues that would cause problems on npm publish. Missing vitest client config forces every consumer to create their own.
- **Done when**: `../config/package.json` has no `main` field. `files` field lists exactly the published directories. `prepublishOnly` script exists. `peerDependenciesMeta` marks vitest/react plugins as optional. `vitest/client.config.ts` exists and is exported. `npm pack --dry-run` in config/ shows correct files.

#### WU-19: Customization script
- **What**: Install `@clack/prompts` and `tsx` at root (tsx may already be installed). Add `scripts/customize.ts` — uses @clack/prompts to interactively ask for: project name (e.g., "my-app"), package scope (e.g., "@myorg"), server port (default 5501), client port (default 5500), description. Then replaces: package names in all package.json files, ports in .env.example + server/src/config/env.ts + client/vite.config.ts, title in client/index.html, description in root package.json. Add `"customize": "tsx scripts/customize.ts"` to root package.json scripts.
- **Why**: Current customization is "search for TODO and rename manually" across ~10 files. An interactive script does it in 30 seconds with no missed files.
- **Done when**: `npm run customize` launches an interactive prompt. Entering a project name + ports updates all relevant files. After customization, `npm run build` and `npm test` still pass. All TODO markers for project-specific values are resolved.

---

## Operational Notes

(Start blank. Update as agents discover learnings during the campaign.)

## Codebase Patterns Discovered

(Start blank. Update as agents discover conventions during the campaign.)
