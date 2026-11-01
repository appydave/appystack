# Testing Guide

Practical reference for testing AppyStack template applications. All examples come from actual
test files in `template/server/src/` and `template/client/src/`.

---

## Test Strategy

| Level | Scope | Tools |
|---|---|---|
| Unit | Pure functions, hooks in isolation | Vitest |
| Integration | Route handlers with Supertest; components with mocked hooks | Vitest + Supertest / Testing Library |
| E2E | Full user flow: page load, socket ping-pong, live HTTP | Playwright |

**Coverage targets** (both workspaces): `lines: 80%` `functions: 70%` `branches: 70%`
`statements: 80%`. Configured in each workspace's `vitest.config.ts`. Threshold failure exits
non-zero and blocks CI.

---

## Server Testing

### Route Tests — Supertest

Mount the router on a minimal Express app. Supertest drives it without binding a real port.
For middleware that propagates errors, attach a catch-all error handler after the middleware
under test.

```typescript
// template/server/src/routes/health.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import healthRouter from './health.js';

const app = express();
app.use(healthRouter);

it('returns ok status', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});

// template/server/src/middleware/errorHandler.test.ts — build app with error handler mounted
function buildApp(thrower: (req: Request, res: Response, next: NextFunction) => void) {
  const app = express();
  app.get('/test', thrower);
  app.use(errorHandler); // catch-all error handler
  return app;
}
```

### Logger Testing — Spy on logger.child(), Not logger.info()

`pino-http` calls level methods on a child logger created via `logger.child({ req })`, not on
the root logger. Spying on `logger.info` directly will never capture any calls.

Spy on `logger.child` and return a controlled mock. Wire `childMock.child` back to `childMock`
to handle nested child calls that pino-http may issue.

```typescript
// template/server/src/middleware/requestLogger.test.ts
import { vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../config/logger.js';

let childMock: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>;
                  error: ReturnType<typeof vi.fn>; child: ReturnType<typeof vi.fn> };

beforeEach(() => {
  childMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() };
  childMock.child.mockReturnValue(childMock);
  vi.spyOn(logger, 'child').mockReturnValue(childMock as unknown as ReturnType<typeof logger.child>);
});
afterEach(() => vi.restoreAllMocks());

it('logs at warn level for 4xx responses', async () => {
  await request(buildApp()).get('/client-error');
  expect(childMock.warn).toHaveBeenCalled();
  expect(childMock.info).not.toHaveBeenCalled();
});
```

### Module Re-evaluation with Cache-Busting

Vitest caches modules after the first import. To force re-execution with different `process.env`
values, append a unique query string to the dynamic import path. Each `?timestamp` gets a fresh
module instance.

```typescript
// template/server/src/config/env.test.ts
it('applies default values when optional vars are absent', async () => {
  process.env.NODE_ENV = 'test';
  delete process.env.PORT;
  const { env } = await import('./env.js?defaults=' + Date.now());
  expect(env.PORT).toBe(5501);
  expect(env.CLIENT_URL).toBe('http://localhost:5500');
});

it('exits with code 1 when NODE_ENV is invalid', async () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as () => never);
  process.env.NODE_ENV = 'staging';
  vi.resetModules(); // must call before the import, not after
  try {
    await import('./env.js?' + Date.now());
  } catch {
    // expected: spreads undefined after mocked exit does not stop execution
  }
  expect(exitSpy).toHaveBeenCalledWith(1);
  exitSpy.mockRestore();
});
```

### Graceful Shutdown

Spy on `process.exit` (mock so execution continues) and `httpServer.close` (invoke callback
immediately, then call the real close). Resolve or reject the test promise inside the exit spy.

```typescript
// template/server/src/shutdown.test.ts
import { vi, beforeEach } from 'vitest';
import { httpServer } from './index.js';

let exitSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as () => never);
});

it('calls process.exit(0) when SIGTERM is emitted', () =>
  new Promise<void>((resolve, reject) => {
    const orig = httpServer.close.bind(httpServer);
    const closeSpy = vi.spyOn(httpServer, 'close').mockImplementation((cb?: (err?: Error) => void) => {
      if (cb) cb(); return orig();
    });
    exitSpy.mockImplementation((() => {
      try { expect(exitSpy).toHaveBeenCalledWith(0); closeSpy.mockRestore(); resolve(); }
      catch (err) { closeSpy.mockRestore(); reject(err); }
    }) as () => never);
    process.emit('SIGTERM');
  }));
```

`index.ts` guards `httpServer.listen()` with `if (!env.isTest)` to prevent `EADDRINUSE` when
multiple test files import `index.ts` in a parallel Vitest run.

---

## Client Testing

### Global Setup

```typescript
// template/client/src/test/setup.ts
import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn()); // prevents accidental real HTTP calls
});
```

### Component Rendering and User Events

```typescript
// template/client/src/demo/ContactForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import ContactForm from './ContactForm.js';

it('shows every validation message when sent empty', async () => {
  render(<ContactForm />);
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument();
});
```

### Mocking Hooks in Component Tests

Use `vi.hoisted` to declare mutable state the `vi.mock` factory closure can reference, then
mutate it in `beforeEach` to control the hook's return value per test.

```typescript
// template/client/src/components/SocketDemo.test.tsx
import { vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockSocketState = vi.hoisted(() => ({
  socket: null as { once: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> } | null,
  connected: false,
  mockOnce: vi.fn(),
  mockEmit: vi.fn(),
}));

vi.mock('../hooks/useSocket.js', () => ({
  useSocket: () => ({ socket: mockSocketState.socket, connected: mockSocketState.connected }),
}));

import SocketDemo from './SocketDemo.js';

beforeEach(() => {
  mockSocketState.mockOnce.mockReset();
  mockSocketState.mockEmit.mockReset();
  mockSocketState.socket = { once: mockSocketState.mockOnce, emit: mockSocketState.mockEmit };
  mockSocketState.connected = true;
});

it('button is enabled when connected', () => {
  render(<SocketDemo />);
  expect(screen.getByRole('button', { name: 'Send Ping' })).not.toBeDisabled();
});
```

### Hook Testing with renderHook

For hooks that fetch, start a real Express server on port 0 in `beforeAll`, then override
`globalThis.fetch` in `beforeEach` to proxy relative paths to that port (overriding the
`vi.fn()` stub from `setup.ts` for this file only). Capture `globalThis.fetch` before
`setup.ts` runs to preserve the native implementation.

```typescript
// template/client/src/hooks/useServerStatus.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useServerStatus } from './useServerStatus.js';

const nativeFetch = globalThis.fetch; // captured at module load, before setup.ts stubs it
// beforeAll: spin up express on port 0, store serverPort from server.address()
// beforeEach: globalThis.fetch = proxy that rewrites relative URLs to http://localhost:serverPort
// afterAll: close server

it('fetches /health and sets health state', async () => {
  const { result } = renderHook(() => useServerStatus());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.health?.status).toBe('ok');
});
```

Full implementation: `template/client/src/hooks/useServerStatus.test.ts`.

---

## Socket.io Testing

Create a real HTTP server in `beforeAll`, bind it on port 0 (OS assigns), and read the port
from `server.address()`. Connect a socket client in `beforeEach` with `forceNew: true` so each
test gets an independent connection. Disconnect in `afterEach`.

```typescript
// template/server/src/socket.test.ts
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { SOCKET_EVENTS } from '@appystack-template/shared';

let io: Server;
let serverPort: number;
let clientSocket: ReturnType<typeof ioc>;

beforeAll(() => new Promise<void>((resolve) => {
  const httpServer = createServer();
  io = new Server(httpServer, { cors: { origin: '*' } });
  io.on('connection', (socket) => {
    socket.on(SOCKET_EVENTS.CLIENT_PING, () =>
      socket.emit(SOCKET_EVENTS.SERVER_PONG, { message: 'pong', timestamp: new Date().toISOString() })
    );
  });
  httpServer.listen(0, () => { serverPort = (httpServer.address() as AddressInfo).port; resolve(); });
}));
afterAll(() => new Promise<void>((resolve) => io.close(() => resolve())));
beforeEach(() => new Promise<void>((resolve) => {
  clientSocket = ioc(`http://localhost:${serverPort}`, { forceNew: true, transports: ['websocket'] });
  clientSocket.on('connect', () => resolve());
}));
afterEach(() => clientSocket.disconnect());

it('receives server:pong when client:ping is emitted', () =>
  new Promise<void>((resolve, reject) => {
    clientSocket.on(SOCKET_EVENTS.SERVER_PONG, (data) => {
      try { expect(data.message).toBe('pong'); resolve(); }
      catch (err) { reject(err); }
    });
    clientSocket.emit(SOCKET_EVENTS.CLIENT_PING);
  }));
```

---

## Coverage

Run `npm test -- --coverage` in the server or client workspace. The text table shows Stmts,
Branch, Funcs, Lines, and Uncovered Line numbers. A threshold failure exits non-zero and blocks CI.

To exclude genuinely unreachable code from counts, use c8 inline comments:

```typescript
/* c8 ignore next */
console.error('defensive guard that cannot be triggered in tests');
```

Use sparingly. Do not ignore code just to hit a threshold.

---

## CI

`template/.github/workflows/ci.yml` runs on every push and pull request to `main`:
`npm ci` → `lint` → `format:check` → `build` → `test`. Node 20 on ubuntu-latest.

E2E tests are not in the default CI job. If you add them, install Playwright browsers first:

```yaml
- run: npx playwright install --with-deps chromium
- run: npx playwright test
```

---

## Common Mistakes

**Spy on `logger.child()`, not `logger.info()`** — pino-http calls level methods on a child
logger, not the root instance. Asserting against the root logger always passes vacuously.

**Reset spies in `afterEach`** — call `vi.restoreAllMocks()` after every test that uses
`vi.spyOn`. Unrestored spies persist into subsequent test files.

**Use `findBy*` or `waitFor` for async content** — `getBy*` throws immediately if the element
is not in the DOM. For content that appears after a fetch response or event, use `findBy*` or
wrap assertions in `waitFor()`.

**Call `vi.resetModules()` before the dynamic import** — not after. Clearing the cache after the
import has no effect on that import. Also use `vi.doMock()` (not `vi.mock()`) inside test bodies;
`vi.mock()` is hoisted to the top of the file and ignores per-test conditions.

**`env.isTest` guard prevents port conflicts** — `index.ts` only calls `httpServer.listen()` when
`env.isTest` is false. Without this guard, every test file that imports `index.ts` would try to
bind the same port and fail with `EADDRINUSE`.
