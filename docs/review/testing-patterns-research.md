# Testing Patterns Research for RVETS Starter Templates

Deep research into testing patterns used by popular React + Vite + Express + TypeScript starter templates and reference projects, conducted February 2026.

---

## 1. What Test Files Do Popular Starter Templates Ship With?

### bulletproof-react (alan2207/bulletproof-react)

The most referenced React architecture project. Ships with a **React-Vite app** variant that includes extensive testing infrastructure.

**Source**: [github.com/alan2207/bulletproof-react](https://github.com/alan2207/bulletproof-react)

**Test file inventory** (react-vite app):

```
apps/react-vite/
  __mocks__/
    vitest-env.d.ts
    zustand.ts                          # Module mock for zustand
  e2e/tests/
    auth.setup.ts                       # Playwright auth setup
    profile.spec.ts                     # E2E profile test
    smoke.spec.ts                       # E2E smoke test (CRUD flow)
  src/
    testing/
      setup-tests.ts                    # Vitest setup: MSW lifecycle, polyfills
      test-utils.tsx                    # Custom render, login helpers, re-exports RTL
      data-generators.ts               # Factory functions for test data
      mocks/
        server.ts                       # MSW setupServer(…handlers)
        browser.ts                      # MSW setupWorker for dev
        db.ts                           # @mswjs/data factory models
        utils.ts                        # Auth helpers (hash, JWT)
        handlers/
          auth.ts                       # MSW handlers for /auth/*
          comments.ts
          discussions.ts
          teams.ts
          users.ts
          index.ts                      # Aggregates all handlers
    components/ui/dialog/__tests__/dialog.test.tsx
    components/ui/dialog/confirmation-dialog/__tests__/confirmation-dialog.test.tsx
    components/ui/drawer/__tests__/drawer.test.tsx
    components/ui/form/__tests__/form.test.tsx
    components/ui/notifications/__tests__/notifications.test.ts
    components/seo/__tests__/head.test.tsx
    features/auth/components/__tests__/login-form.test.tsx
    features/auth/components/__tests__/register-form.test.tsx
    hooks/__tests__/use-disclosure.test.ts
    lib/__tests__/authorization.test.tsx
    app/routes/app/discussions/__tests__/discussion.test.tsx
    app/routes/app/discussions/__tests__/discussions.test.tsx
```

**Key patterns**:
- Co-located `__tests__/` directories next to source
- Centralized `src/testing/` for shared utilities, MSW mocks, and data generators
- `@mswjs/data` for an in-memory mock database (models mirror the real schema)
- Separate E2E with Playwright in `e2e/tests/`
- `setup-tests.ts` wires MSW lifecycle (beforeAll/afterAll/afterEach)
- Full MSW handler set for every API domain

**Applicability**: This is a mature app reference. For a starter template, ship a subset: one unit test, one integration test, the MSW skeleton, and the smoke E2E.

---

### create-t3-app (t3-oss/create-t3-app)

**Source**: [github.com/t3-oss/create-t3-app](https://github.com/t3-oss/create-t3-app), [Issue #1180](https://github.com/t3-oss/create-t3-app/issues/1180)

**Ships zero test files**. Issue #1180 requested adding test setup and was closed without tests being added. The main blocker was `.env` loading during tests (Zod schema validation fails without environment variables).

**Key takeaway**: The most popular full-stack starter template chose NOT to ship tests. This is a gap, not a best practice. Users repeatedly complained about difficulty setting up testing. A starter template that ships working test infrastructure has a competitive advantage.

---

### AlbertHernandez/express-typescript-service-template

**Source**: [github.com/AlbertHernandez/express-typescript-service-template](https://github.com/AlbertHernandez/express-typescript-service-template)

**Test file inventory**:

```
.env.test                                    # Test environment variables
create-vitest-test-config.ts                 # Shared config factory
vitest.config.ts                             # Base config
vitest.config.unit.ts                        # Unit test config
vitest.config.e2e.ts                         # E2E test config
scripts/calculate-global-test-coverage.ts    # Merges coverage reports
tests/
  e2e/
    health.test.ts                           # Supertest health check
  unit/
    contexts/users/api/
      user-controller.test.ts                # Controller unit test
  performance/
    contexts/users/get-users.mjs             # k6 load test
```

**Key patterns**:
- Separate vitest configs per test type (unit vs e2e)
- Centralized `tests/` directory (NOT co-located)
- Shared config factory function:

```typescript
// create-vitest-test-config.ts
export const createVitestTestConfig = (testingType: string): InlineConfig => {
  return {
    root: "./",
    globals: true,
    isolate: false,
    passWithNoTests: true,
    include: [`tests/${testingType}/**/*.test.ts`],
    env: loadEnv("test", process.cwd(), ""),
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "html"],
      reportsDirectory: `coverage/${testingType}`,
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts"],
    },
  };
};
```

- Health check E2E test uses Supertest:

```typescript
describe("Health", () => {
  let server: Server;
  beforeAll(async () => {
    server = new Server();
    await server.start();
    nock.disableNetConnect();
    nock.enableNetConnect("127.0.0.1");
  });
  afterAll(async () => {
    await server.stop();
    nock.enableNetConnect();
  });
  it("/GET api/health", async () => {
    const response = await request(server.getHttpServer()).get("/api/health");
    expect(response.status).toBe(StatusCodes.OK);
  });
});
```

**Applicability**: Excellent server-side starter pattern. The health check test is exactly right for a template -- minimal but proves the server boots and responds.

---

### edwinhern/express-typescript (Express TypeScript Boilerplate 2024)

**Source**: [github.com/edwinhern/express-typescript](https://github.com/edwinhern/express-typescript)

**Uses co-located `__tests__/` within feature modules**:

```
src/api/
  healthCheck/__tests__/healthCheckRouter.test.ts
  user/__tests__/
    userRouter.test.ts
    userService.test.ts
src/common/__tests__/
  errorHandler.test.ts
  requestLogger.test.ts
```

**Key pattern**: Co-locates tests with features. Tests both routes (supertest) and services (unit). No separate E2E.

**Applicability**: Good pattern for co-located server tests. Simpler than AlbertHernandez but equally valid.

---

### vite-react-boilerplate (RicardoValdovinos)

**Source**: [github.com/RicardoValdovinos/vite-react-boilerplate](https://github.com/RicardoValdovinos/vite-react-boilerplate)

Ships with Vitest for unit tests and Playwright for E2E. Co-locates unit tests with source. Uses React Testing Library.

**Applicability**: Demonstrates that production-oriented Vite+React templates DO include both unit and E2E testing from the start.

---

## 2. Hook Testing Patterns

### Recommended approach: `renderHook` from `@testing-library/react`

**Source**: [kentcdodds.com/blog/how-to-test-custom-react-hooks](https://kentcdodds.com/blog/how-to-test-custom-react-hooks), [builder.io/blog/test-custom-hooks-react-testing-library](https://www.builder.io/blog/test-custom-hooks-react-testing-library)

The standalone `@testing-library/react-hooks` package is **deprecated**. `renderHook` is now built into `@testing-library/react` (v13.1+).

**Decision tree**:

| Hook type | Approach |
|-----------|----------|
| Simple state hooks (toggle, counter) | `renderHook` directly |
| Hooks used by one component | Test through the component instead |
| Hooks with complex setup (providers, context) | `renderHook` with `wrapper` option |
| Hooks that fetch data | `renderHook` + MSW (or mock fetch) + `waitFor` |

**bulletproof-react example** (simple state hook):

```typescript
import { renderHook, act } from '@testing-library/react';
import { useDisclosure } from '../use-disclosure';

test('should open the state', () => {
  const { result } = renderHook(() => useDisclosure());
  expect(result.current.isOpen).toBe(false);
  act(() => {
    result.current.open();
  });
  expect(result.current.isOpen).toBe(true);
});
```

**For hooks that make network calls** (e.g., `useQuery` wrappers):

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

test('useUser fetches user data', async () => {
  // MSW intercepts the request
  const { result } = renderHook(() => useUser('123'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data.name).toBe('John');
});
```

**Applicability for starter template**: Ship one `renderHook` example for a simple hook. Document the pattern for async hooks with MSW but don't require it in the template.

---

## 3. Socket.io Testing

### Available approaches

| Approach | Package | Best for |
|----------|---------|----------|
| Real connections | `socket.io` + `socket.io-client` | Integration tests |
| Mock library | `socket.io-mock-ts` | Unit tests |
| MSW WebSocket | `msw` (experimental) | Component tests |

### Official Socket.io pattern (Vitest, real connections)

**Source**: [socket.io/docs/v4/testing](https://socket.io/docs/v4/testing/)

```typescript
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createServer } from "node:http";
import { io as ioc } from "socket.io-client";
import { Server } from "socket.io";

function waitFor(socket, event) {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

describe("my awesome project", () => {
  let io, serverSocket, clientSocket;

  beforeAll(() => {
    return new Promise((resolve) => {
      const httpServer = createServer();
      io = new Server(httpServer);
      httpServer.listen(() => {
        const port = httpServer.address().port;
        clientSocket = ioc(`http://localhost:${port}`);
        io.on("connection", (socket) => {
          serverSocket = socket;
        });
        clientSocket.on("connect", resolve);
      });
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.disconnect();
  });

  it("should work with emitWithAck()", async () => {
    serverSocket.on("foo", (cb) => {
      cb("bar");
    });
    const result = await clientSocket.emitWithAck("foo");
    expect(result).toEqual("bar");
  });

  it("should work with waitFor()", () => {
    clientSocket.emit("baz");
    return waitFor(serverSocket, "baz");
  });
});
```

### socket.io-mock-ts (unit testing without server)

**Source**: [github.com/james-elicx/socket.io-mock-ts](https://github.com/james-elicx/socket.io-mock-ts), [npmjs.com/package/socket.io-mock-ts](https://www.npmjs.com/package/socket.io-mock-ts)

```typescript
import { SocketServerMock } from 'socket.io-mock-ts';
import { expect, test } from 'vitest';

test('handles message event', async () => {
  const socket = new SocketServerMock();

  const data = await new Promise((resolve) => {
    socket.on('message', (message: string) => {
      resolve(message);
    });
    socket.clientMock.emit('message', 'Hello World!');
  });

  expect(data).toBe('Hello World!');
});
```

### Recommended strategy for RVETS starter

| Test type | Approach | Where |
|-----------|----------|-------|
| Server event handlers | Real connections (official pattern) | `server/src/__tests__/` or `server/tests/` |
| Client socket hooks | `socket.io-mock-ts` or mock the hook | `client/src/hooks/__tests__/` |
| Round-trip integration | Real server + real client in test | `tests/integration/` or E2E |

**Applicability**: Ship the official Socket.io Vitest pattern as a server test. For client hooks, a simple mock is sufficient. Round-trip tests are valuable but better suited for a mature app than a starter.

---

## 4. MSW (Mock Service Worker)

### Is MSW still recommended in 2026?

**Yes**. MSW v2 is the standard approach for API mocking in React tests.

**Source**: [mswjs.io](https://mswjs.io/), [stevekinney.com/courses/testing/testing-with-mock-service-worker](https://stevekinney.com/courses/testing/testing-with-mock-service-worker)

bulletproof-react uses it. Vitest's own documentation links to MSW. Kent C. Dodds recommends it. The `@mswjs/data` companion package adds an in-memory database.

### Standard MSW v2 + Vitest setup

**Handlers** (`src/testing/mocks/handlers.ts`):

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/user', () => {
    return HttpResponse.json({
      id: 'abc-123',
      firstName: 'John',
    });
  }),
];
```

**Server** (`src/testing/mocks/server.ts`):

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

**Setup file** (`vitest.setup.ts`):

```typescript
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './testing/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Config** (`vitest.config.ts`):

```typescript
export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

### Setup cost

| Item | Effort |
|------|--------|
| Install `msw` | Trivial |
| Create handler skeleton | 10-15 min |
| Wire setup file | 5 min |
| Write first handler | 5-10 min per endpoint |
| `@mswjs/data` factory models | 30-60 min (optional, advanced) |

**Total for a starter template**: ~30 minutes to get a working MSW skeleton with one example handler.

### Monorepo considerations

In an npm-workspaces monorepo (client/server/shared), MSW is only needed in the **client** package (for component/integration tests). Server tests use Supertest against real Express routes. The shared package may not need MSW at all.

```
packages/
  client/
    src/testing/mocks/       # MSW lives here
    vitest.setup.ts          # Wires MSW
  server/
    tests/                   # Uses supertest, no MSW
  shared/
    tests/                   # Pure unit tests, no MSW
```

**Applicability**: Ship the MSW skeleton in the client package with one example handler. This is the highest-value testing infrastructure to include.

---

## 5. Co-located vs Centralized Tests

### Current consensus (2025-2026)

**Source**: [kentcdodds.com/blog/colocation](https://kentcdodds.com/blog/colocation), [yockyard.com/post/co-locate-unit-tests](https://www.yockyard.com/post/co-locate-unit-tests/)

**Hybrid approach is the consensus**:

| Test type | Location | Rationale |
|-----------|----------|-----------|
| Unit tests | Co-located `__tests__/` next to source | Discoverability, maintained alongside code |
| Integration tests | Centralized `tests/integration/` | Cross-cutting, don't belong to one module |
| E2E tests | Separate `e2e/` directory | Different runner, different config |
| Test utilities/mocks | Centralized `src/testing/` | Shared across all tests |

**What real projects do**:

| Project | Pattern |
|---------|---------|
| bulletproof-react | Co-located `__tests__/` + centralized `src/testing/` |
| edwinhern/express-typescript | Co-located `__tests__/` within features |
| AlbertHernandez/express-template | Centralized `tests/unit/` and `tests/e2e/` |
| React (facebook/react) | Co-located `__tests__/` |
| create-t3-app | No tests at all |

**Recommendation for RVETS starter**: Use co-located `__tests__/` for unit tests, centralized `tests/` or `e2e/` for integration and E2E. This mirrors bulletproof-react and aligns with community consensus.

---

## 6. Coverage Thresholds

### What popular projects enforce

**Source**: [vitest.dev/config/coverage](https://vitest.dev/config/coverage), [vitest.dev/guide/coverage](https://vitest.dev/guide/coverage)

| Project / Context | Threshold | Notes |
|-------------------|-----------|-------|
| Common starter template pattern | 80% all categories | Achievable baseline |
| Stricter enterprise pattern | 85% all categories | Common in production apps |
| Per-file pattern (utilities) | 90-95% for `src/utils/**` | Higher bar for critical code |
| GitHub Actions visual | 80% = warning, 90% = green | Common CI badge thresholds |

**Vitest configuration example**:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/main.ts', 'src/**/*.d.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

**Do starter templates set thresholds?** Mostly no. AlbertHernandez's template configures coverage reporters but does not set thresholds. bulletproof-react does not enforce thresholds. The common pattern is to include coverage configuration but leave thresholds commented out or absent.

**Recommendation for RVETS starter**: Include coverage configuration with reporters. Add thresholds as a comment showing the recommended values but don't enforce them -- a starter with 2 example tests would fail an 80% threshold. Document how to enable them once the app matures.

---

## 7. Integration/E2E Testing in Monorepos

### Do starter templates include Playwright?

| Template | Playwright? | Notes |
|----------|-------------|-------|
| bulletproof-react | Yes | Full CRUD smoke test + auth setup |
| vite-react-boilerplate | Yes | UI E2E tests |
| AlbertHernandez/express-template | No | Uses Supertest for E2E instead |
| create-t3-app | No | No tests at all |

### Lightest-weight integration test pattern

For verifying the **client -> proxy -> server** chain works in a RVETS monorepo, there are two approaches:

**Option A: Supertest on the Express server (no browser)**

```typescript
// tests/integration/proxy-health.test.ts
import request from 'supertest';
import { createApp } from '@/app';

describe('Server Health', () => {
  let app;
  beforeAll(async () => { app = await createApp(); });

  it('responds to /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

**Option B: Playwright API testing (no browser, verifies full stack)**

**Source**: [playwright.dev/docs/api-testing](https://playwright.dev/docs/api-testing)

```typescript
// e2e/api-smoke.spec.ts
import { test, expect } from '@playwright/test';

test('API health check', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({ status: 'ok' });
});
```

**Option C: Playwright browser smoke test (full UI)**

From bulletproof-react's `smoke.spec.ts` -- a single test that exercises the entire CRUD flow through the browser. This is the gold standard but heavyweight for a starter.

### Monorepo E2E structure

**Source**: [turborepo.com/docs/guides/tools/playwright](https://turborepo.com/docs/guides/tools/playwright), [kyrre.dev/blog/end-to-end-testing-setup](https://www.kyrre.dev/blog/end-to-end-testing-setup)

Turborepo recommends a separate Playwright package per test suite:

```
packages/
  client/          # Vite + React
  server/          # Express
  shared/          # Shared types
  e2e/             # Playwright lives here (separate package)
    playwright.config.ts
    tests/
      smoke.spec.ts
      api-health.spec.ts
```

**Recommendation for RVETS starter**: Include a minimal Playwright config in a root-level `e2e/` directory with ONE smoke test (either API-only health check or a simple page load). This proves the infrastructure works without adding maintenance burden.

---

## Summary: What to Ship in an AppyStack Template

### Minimum viable test infrastructure

```
packages/
  client/
    src/
      testing/
        setup-tests.ts              # MSW lifecycle + polyfills
        mocks/
          server.ts                 # setupServer(...handlers)
          handlers/
            index.ts                # One example handler
      components/__tests__/
        example.test.tsx            # One component test with RTL
      hooks/__tests__/
        use-example.test.ts         # One renderHook example
    vitest.config.ts                # jsdom environment, setup files

  server/
    src/
      routes/__tests__/
        health.test.ts              # Supertest health check
    tests/
      socket.test.ts                # Socket.io official pattern
    vitest.config.ts                # Node environment

  e2e/
    playwright.config.ts
    tests/
      smoke.spec.ts                 # Minimal: page loads, API responds
```

### Key dependencies to include

```json
{
  "devDependencies": {
    "vitest": "^3.x",
    "@testing-library/react": "^16.x",
    "@testing-library/jest-dom": "^6.x",
    "@testing-library/user-event": "^14.x",
    "msw": "^2.x",
    "supertest": "^7.x",
    "@types/supertest": "^6.x",
    "@playwright/test": "^1.x"
  }
}
```

### What NOT to ship (leave for mature apps)

- `@mswjs/data` factory models (bulletproof-react level -- too complex for starter)
- Coverage thresholds (will fail with few tests)
- Performance/load tests (k6)
- Full MSW handler sets for every endpoint
- Full CRUD E2E tests
- CI pipeline for coverage reporting

---

## Sources

- [bulletproof-react](https://github.com/alan2207/bulletproof-react) - Project structure, testing docs, actual test files
- [bulletproof-react testing docs](https://github.com/alan2207/bulletproof-react/blob/master/docs/testing.md)
- [create-t3-app Issue #1180](https://github.com/t3-oss/create-t3-app/issues/1180) - Testing feature request (closed, never shipped)
- [AlbertHernandez/express-typescript-service-template](https://github.com/AlbertHernandez/express-typescript-service-template) - Server test patterns
- [edwinhern/express-typescript](https://github.com/edwinhern/express-typescript) - Co-located Express test pattern
- [Socket.IO Testing Docs](https://socket.io/docs/v4/testing/) - Official Vitest example
- [socket.io-mock-ts](https://github.com/james-elicx/socket.io-mock-ts) - TypeScript mock for Socket.IO
- [MSW Quick Start](https://mswjs.io/docs/quick-start/) - MSW v2 setup
- [MSW Node.js Integration](https://mswjs.io/docs/integrations/node/) - Server setup for Vitest
- [Kent C. Dodds - How to test custom React hooks](https://kentcdodds.com/blog/how-to-test-custom-react-hooks)
- [Kent C. Dodds - Colocation](https://kentcdodds.com/blog/colocation) - Co-located test consensus
- [Vitest Coverage Config](https://vitest.dev/config/coverage) - Threshold configuration
- [Playwright API Testing](https://playwright.dev/docs/api-testing) - Browserless API tests
- [Turborepo Playwright Guide](https://turborepo.com/docs/guides/tools/playwright) - Monorepo E2E setup
- [RicardoValdovinos/vite-react-boilerplate](https://github.com/RicardoValdovinos/vite-react-boilerplate)
- [MSW + Vitest setup (Steve Kinney)](https://stevekinney.com/courses/testing/testing-with-mock-service-worker)
- [Yockyard - Co-locate Unit Tests](https://www.yockyard.com/post/co-locate-unit-tests/)
