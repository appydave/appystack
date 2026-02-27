# API Design

> Conventions, patterns, and step-by-step guide for building REST endpoints in the AppyStack server.

## Route Organisation

Routes follow a file-per-resource pattern. Each resource gets its own file under `server/src/routes/`, exports a single `Router`, and is mounted in `server/src/index.ts`.

```
server/src/routes/
  health.ts     ← GET /health
  info.ts       ← GET /api/info
```

Each route file creates a Router, registers handlers, and exports it as the default. For example, `health.ts` uses a typed `HealthResponse` return:

```typescript
// server/src/routes/health.ts
import { Router } from 'express';
import type { HealthResponse } from '@appystack-template/shared';

const router = Router();
router.get('/health', (_req, res) => {
  const response: HealthResponse = { status: 'ok', timestamp: new Date().toISOString() };
  res.json(response);
});
export default router;
```

Routers mount in `server/src/index.ts` after middleware and before the 404 catch-all:

```typescript
import healthRouter from './routes/health.js';
import infoRouter from './routes/info.js';
app.use(healthRouter);
app.use(infoRouter);
```

The `/api/` prefix lives in the route string itself (e.g. `router.get('/api/info', ...)`), not at the mount call. This keeps each file self-documenting about its full path.

---

## Request Validation with Zod

`server/src/middleware/validate.ts` accepts a schema with optional `body`, `query`, and `params` keys. It runs `parse()` on each and sends a 400 on `ZodError`. One Express 5 quirk: `req.query` is a getter, so use `Object.assign` to mutate it in place rather than reassigning.

Use it as route-level middleware:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const router = Router();

// Validate request body
router.post(
  '/api/items',
  validate({ body: z.object({ name: z.string().min(1), quantity: z.number().int().positive() }) }),
  (req, res) => {
    res.json({ status: 'ok', data: req.body, timestamp: new Date().toISOString() });
  }
);

// Validate params and query string
router.get(
  '/api/items/:id',
  validate({
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ format: z.enum(['short', 'full']).optional() }),
  }),
  (req, res) => {
    res.json({ status: 'ok', data: { id: req.params.id }, timestamp: new Date().toISOString() });
  }
);
```

Validation failures produce a 400 with the full Zod error array in `error`, making client-side field mapping straightforward.

---

## Response Shape

All endpoints use `ApiResponse<T>` from `shared/src/types.ts`. Success responses populate `data`; error responses populate `error`. Every response includes a `timestamp` ISO string.

```typescript
// shared/src/types.ts
export interface ApiResponse<T = unknown> {
  status: 'ok' | 'error';
  data?: T;
  error?: string;
  timestamp: string;
}

// server/src/routes/info.ts — usage
import type { ApiResponse, ServerInfo } from '@appystack-template/shared';

const response: ApiResponse<ServerInfo> = {
  status: 'ok',
  data: { nodeVersion: process.version, environment: env.NODE_ENV,
          port: env.PORT, clientUrl: env.CLIENT_URL, uptime: process.uptime() },
  timestamp: new Date().toISOString(),
};
res.json(response);
```

---

## Error Responses

`server/src/middleware/errorHandler.ts` exports `AppError` and the global `errorHandler`.

```typescript
export class AppError extends Error {
  constructor(public statusCode: number, message: string, public isOperational = true) {
    super(message);
    this.name = 'AppError';
  }
}
```

Throw `AppError` in any route and call `next(err)` to forward it to the handler:

```typescript
import { AppError } from '../middleware/errorHandler.js';

router.get('/api/items/:id', async (req, res, next) => {
  try {
    const item = await findItem(req.params.id);
    if (!item) throw new AppError(404, 'Item not found');
    res.json({ status: 'ok', data: item, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
```

The `isOperational` flag controls message exposure. Operational errors (default) send their message to the client. Non-operational errors always return `'Internal server error'`.

| Status | When to use |
|--------|-------------|
| `400`  | Invalid input — `validate` middleware handles this automatically |
| `401`  | Missing or invalid auth token |
| `403`  | Authenticated but not authorised |
| `404`  | Resource not found — safe to expose to clients |
| `500`  | Unhandled errors — message is hidden from clients |

---

## Adding a New Endpoint

**Step 1 — Add shared types** to `shared/src/types.ts`:

```typescript
export interface User { id: string; name: string; email: string; }
```

**Step 2 — Create `server/src/routes/users.ts`**:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import type { ApiResponse, User } from '@appystack-template/shared';

const router = Router();

router.post('/api/users',
  validate({ body: z.object({ name: z.string().min(1), email: z.string().email() }) }),
  async (req, res, next) => {
    try {
      const user: User = { id: crypto.randomUUID(), name: req.body.name, email: req.body.email };
      res.status(201).json({ status: 'ok', data: user, timestamp: new Date().toISOString() } satisfies ApiResponse<User>);
    } catch (err) { next(err); }
  }
);

router.get('/api/users/:id', async (req, res, next) => {
  try {
    const user = null; // replace with real DB lookup
    if (!user) throw new AppError(404, `User ${req.params.id} not found`);
    res.json({ status: 'ok', data: user, timestamp: new Date().toISOString() });
  } catch (err) { next(err); }
});

export default router;
```

**Step 3 — Mount in `server/src/index.ts`**:

```typescript
import usersRouter from './routes/users.js';
app.use(usersRouter);
```

**Step 4 — Test with Supertest** in `server/src/routes/users.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('POST /api/users', () => {
  it('creates a user', async () => {
    const res = await request(app).post('/api/users').send({ name: 'Alice', email: 'a@b.com' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Alice');
  });
  it('rejects invalid email', async () => {
    const res = await request(app).post('/api/users').send({ name: 'Alice', email: 'bad' });
    expect(res.status).toBe(400);
  });
});
```

---

## API Versioning Strategy

The template uses unversioned paths (`/api/info`). Add versioning only when you need to ship a breaking change while keeping old clients working. Embed the version in the route string — not at the mount point:

```typescript
// server/src/routes/v1/users.ts
router.get('/api/v1/users', ...);
router.post('/api/v1/users', ...);
```

Mount and register exactly the same way as unversioned routers (`app.use(v1UsersRouter)`). Keep v1 routes alive until client traffic migrates, then delete the files. Mirror versioning in `shared/src/types/v1.ts` only when response shapes differ materially between versions.

---

## Using the Typed API Wrapper from the Client

`client/src/utils/api.ts` is a thin typed wrapper around `fetch`. It reads `VITE_API_URL` (defaults to `''`, which works with the Vite dev proxy) and throws `ApiError` on non-2xx responses.

```typescript
import { api, ApiError } from '../utils/api.js';
import type { ApiResponse, User } from '@appystack-template/shared';

// GET — fully typed
const info = await api.get<ApiResponse<ServerInfo>>('/api/info');

// POST with JSON body
const result = await api.post<ApiResponse<User>>('/api/users', { name: 'Alice', email: 'a@b.com' });

// Handle status codes without parsing the response manually
try {
  return await api.post<ApiResponse<User>>('/api/users', { name, email });
} catch (err) {
  if (err instanceof ApiError && err.status === 400) throw err; // surface to form
  throw new Error('Unexpected error, please try again');
}

// AbortSignal for useEffect cleanup
useEffect(() => {
  const controller = new AbortController();
  api.get<ApiResponse<User[]>>('/api/users', controller.signal).then(setUsers);
  return () => controller.abort();
}, []);
```

For auth headers, retry logic, or caching, extend `request()` in `api.ts` — do not call `fetch` directly in components.
