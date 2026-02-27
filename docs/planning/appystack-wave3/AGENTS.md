# AGENTS.md — AppyStack Wave 3 Campaign

## What This Is

Operational knowledge for a Ralph Wiggum Task Agent campaign. Each agent receives this file + a specific work unit prompt.

**Campaign**: AppyStack Wave 3 — Test completeness, foundation fixes, production pattern examples
**Repo**: `/Users/davidcruwys/dev/ad/apps/appystack`
**Template**: `/Users/davidcruwys/dev/ad/apps/appystack/template/`
**Config package**: `/Users/davidcruwys/dev/ad/apps/appystack/config/`
**GitHub repo**: `https://github.com/appydave/appystack`
**npm package**: `@appydave/appystack-config` (published, v1.0.3)

---

## Build & Run Commands

```bash
cd /Users/davidcruwys/dev/ad/apps/appystack/template

# Install
npm install

# Dev (both servers, concurrently)
npm run dev

# Build (order matters: shared → server → client)
npm run build

# Individual workspace builds
npm run build -w shared
npm run build -w server
npm run build -w client

# Tests
npm test                    # all workspaces
npm test -w server          # server only
npm test -w client          # client only
npm run test:coverage       # with coverage report
npm run test:e2e            # Playwright E2E

# Quality checks (ALL must pass before committing)
npm run format:check
npm run lint
npm run build
npm test

# Fix formatting
npm run format

# TypeScript check across all workspaces
npm run typecheck
```

---

## Directory Structure

```
config/                                   # @appydave/appystack-config (published to npm)
  eslint/base.config.js
  eslint/react.config.js
  vitest/server.config.ts
  vitest/client.config.ts
  typescript/base.json                    # Wave 3: add strictness options here
  typescript/react.json
  typescript/node.json
  prettier/.prettierrc

template/
  package.json                            # root workspace
  eslint.config.js                        # imports @appydave/appystack-config/eslint/react
  shared/
    src/types.ts                          # ApiResponse, HealthResponse, ServerInfo, SocketEvents
    src/constants.ts                      # ROUTES, SOCKET_EVENTS
  server/
    src/index.ts                          # Express + Socket.io + graceful shutdown (Wave 3: socket auth comment)
    src/config/env.ts                     # Zod env validation (console.error is correct — see Notes)
    src/config/logger.ts                  # Pino logger (Wave 3: add logger.test.ts alongside)
    src/middleware/errorHandler.ts
    src/middleware/validate.ts
    src/middleware/rateLimiter.ts
    src/middleware/requestLogger.ts       # Wave 3: extend requestLogger.test.ts
    src/routes/health.ts
    src/routes/info.ts
    src/test/setup.ts                     # server test setup
    vitest.config.ts
  client/
    src/main.tsx                          # Wave 3: add main.test.tsx
    src/App.tsx
    src/App.test.tsx                      # Wave 3: remove duplicated fetch mock (move to setup)
    src/vite-env.d.ts                     # ImportMetaEnv interface
    src/hooks/useSocket.ts
    src/hooks/useServerStatus.ts
    src/components/ErrorFallback.tsx
    src/components/SocketDemo.tsx         # Wave 3: extend SocketDemo.test.tsx
    src/components/StatusGrid.tsx         # Wave 3: extend StatusGrid.test.tsx (StatusDot)
    src/components/TechStackDisplay.tsx
    src/test/setup.ts                     # Wave 3: centralise fetch mock here
    src/utils/                            # Wave 3: create api.ts here
    vitest.config.ts
  e2e/
    smoke.test.ts                         # existing basic E2E
    socket.test.ts                        # Wave 3: new E2E for socket ping-pong
```

---

## Quality Gates (non-negotiable)

Before marking any work unit complete, verify ALL of the following:

```bash
cd /Users/davidcruwys/dev/ad/apps/appystack/template
npm run format:check   # must pass
npm run lint           # must pass (0 errors)
npm run build          # must compile cleanly
npm test               # must pass — test count must not DECREASE
```

Additional gates per work unit type:
- **Test work units**: new tests must be co-located with source file, test count must increase
- **Config changes (WU-3)**: `npm run typecheck` must pass across all three workspaces after adding strictness options
- **New dependencies**: run `npm view <package> version` before installing — confirm version exists
- **Pattern work units (WU-13, WU-14, WU-15)**: new files must lint clean and have at least one test

---

## Inherited Patterns (from Waves 1 + 2)

### TypeScript — strict, no shortcuts
```typescript
// Use import type for type-only imports
import type { ApiResponse } from '@appystack-template/shared';

// No any — use unknown and narrow
function processData(data: unknown): string {
  if (typeof data !== 'string') throw new Error('Expected string');
  return data;
}

// .js extensions required for ESM imports
import { env } from './config/env.js';
```

### Express Routes — Router pattern
```typescript
import { Router } from 'express';
const router = Router();
router.get('/path', (req, res) => { ... });
export default router;
```

### React Components — function components, no default export for named components
```typescript
export default function ComponentName({ prop }: Props) { ... }
```

### TailwindCSS v4 — import syntax only
```css
@import 'tailwindcss';
@source "../";
/* NEVER use @tailwind base / components / utilities */
```

### ESLint 9 flat config — no legacy files
```javascript
// eslint.config.js — always flat config format
import appyConfig from '@appydave/appystack-config/eslint/react';
export default [...appyConfig];
```

---

## Testing Patterns (Wave 3 focus)

### Server unit tests — Vitest + Supertest
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';   // named export

describe('health route', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
```

### Client unit tests — Vitest + Testing Library
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MyComponent from './MyComponent.js';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Centralised fetch mock (Wave 3 — move from individual files to setup.ts)
```typescript
// client/src/test/setup.ts — add this once
import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
```

### Logger test pattern
```typescript
// logger.test.ts — test logger without actually logging
import { describe, it, expect, vi } from 'vitest';

// Mock pino before importing logger
vi.mock('pino', () => ({
  default: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn() }))
}));

import pino from 'pino';

describe('logger', () => {
  it('uses debug level in development', async () => {
    process.env.NODE_ENV = 'development';
    await import('./logger.js');
    expect(pino).toHaveBeenCalledWith(expect.objectContaining({ level: 'debug' }));
  });
});
```

### Graceful shutdown test pattern
```typescript
// shutdown.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('graceful shutdown', () => {
  it('closes server on SIGTERM', async () => {
    const mockClose = vi.fn((cb) => cb());
    // Intercept httpServer.close and io.close
    // Emit SIGTERM and verify process.exit(0) is called
  });
});
```

### MSW pattern (Wave 3 — new)
```typescript
// client/src/test/msw/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/health', () => {
    return HttpResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  }),
  http.get('/api/info', () => {
    return HttpResponse.json({ name: 'AppyStack', version: '1.0.0' });
  }),
];

// client/src/test/msw/server.ts (for Vitest/Node)
import { setupServer } from 'msw/node';
import { handlers } from './handlers.js';
export const server = setupServer(...handlers);

// client/src/test/msw/browser.ts (for browser/Storybook)
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers.js';
export const worker = setupWorker(...handlers);
```

### React Hook Form + Zod pattern (Wave 3 — new)
```typescript
// ContactForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type FormData = z.infer<typeof schema>;

export default function ContactForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    console.log(data); // TODO: wire to your API
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
      {/* etc */}
      <button type="submit">Submit</button>
    </form>
  );
}
```

### API request wrapper pattern (Wave 3 — new)
```typescript
// client/src/utils/api.ts
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    throw new ApiError(res.status, `Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, signal }),
};

export { ApiError };
```

---

## Anti-Patterns — DO NOT DO THESE

- **NO `npx husky init`** — already configured, will break it
- **NO vi.mock() for entire hooks** — test against real lightweight servers or MSW
- **NO jest.fn()** — this is Vitest, use `vi.fn()`
- **NO centralized test/ directories** — co-locate test files next to source
- **NO TailwindCSS v3 syntax** — `@import 'tailwindcss'` only
- **NO .eslintrc files** — ESLint 9 flat config only
- **NO adding dependencies without checking versions** — `npm view <pkg> version` first
- **NO changing console.error to logger.error in env.ts** — circular dependency, intentional
- **NO implementing real JWT auth in socket auth example** — comment/pattern only
- **NO building a full form UI** — ContactForm shows the RHF+Zod pattern, minimal styling

---

## Operational Notes (Inherited)

- **Husky**: `template/` is nested inside the repo root. `.husky/` files exist — do not re-run `npx husky init`
- **Express 5**: `req.query` is read-only. Use `Object.assign(req.query, value)`. Already fixed in validate.ts — do not regress.
- **ESLint 9**: flat config only. Never use `--ext` flag.
- **Build order**: shared → server → client. Server imports from `shared/dist/` — shared must be built first.
- **Vite tsconfig warning**: non-fatal "Cannot find base config" warning on fresh install. TypeScript (tsc) resolves correctly. Do not attempt to fix — it's a tsconfck issue.
- **console.error in env.ts**: intentional. logger.ts imports env.ts → using logger in env.ts = circular dependency. Leave as-is.
- **Test isolation**: server tests use `beforeAll`/`afterAll` to start/stop real servers on port 0. Do not share server instances across describe blocks.

---

## Work Unit Format

Each work unit is self-contained. Complete one, validate all four quality gates, commit, move to next.

```
**What**: specific changes to make
**Why**: the problem this solves
**Done when**: verifiable criteria — check these before reporting complete
```
