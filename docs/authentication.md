# Authentication

> How to implement JWT authentication in an AppyStack application — covering server middleware, auth routes, Socket.io handshake auth, client token storage, and testing.

AppyStack intentionally ships without authentication so consumer projects can choose the approach that fits their requirements. This guide shows how to add JWT authentication in the pattern the rest of the stack uses: Zod for validation, `AppError` for error handling, `apiSuccess` for responses, and the existing `validate` middleware for request bodies.

---

## Table of Contents

- [Overview](#overview)
- [Install dependencies](#install-dependencies)
- [Server: Environment setup](#server-environment-setup)
- [Server: Auth routes](#server-auth-routes)
- [Server: Auth middleware](#server-auth-middleware)
- [Server: Protecting routes](#server-protecting-routes)
- [Server: Socket.io auth](#server-socketio-auth)
- [Client: Token storage](#client-token-storage)
- [Client: Sending tokens](#client-sending-tokens)
- [Client: Socket.io auth](#client-socketio-auth)
- [Testing](#testing)
- [Security notes](#security-notes)

---

## Overview

JWT (JSON Web Token) is a good fit for AppyStack for three reasons:

1. **Stateless** — the server does not need a session store. Every verified request carries its own identity payload.
2. **Socket.io compatible** — the `socket.handshake.auth` object lets clients pass a token at connection time, before any events fire.
3. **Zod-compatible** — the same Zod schema pattern used in `env.ts` and `validate.ts` validates login request bodies with no additional libraries.

The implementation adds four files to the server and updates three files on the client:

| File | Change |
|------|--------|
| `server/src/config/env.ts` | Add `JWT_SECRET` to the Zod schema |
| `server/src/routes/auth.ts` | New — login and logout endpoints |
| `server/src/middleware/auth.ts` | New — Bearer token verification middleware |
| `server/src/index.ts` | Mount auth router; complete the Socket.io auth comment |
| `client/src/utils/tokenStore.ts` | New — in-memory token store |
| `client/src/utils/api.ts` | Extend `request()` to include `Authorization` header |
| `client/src/hooks/useSocket.ts` | Pass token via `auth` option in `io()` |

---

## Install dependencies

```bash
# From the project root
npm install jsonwebtoken --workspace server
npm install --save-dev @types/jsonwebtoken --workspace server
```

`jsonwebtoken` is the standard Node.js JWT library. It provides `sign()` and `verify()` — both are used in the server implementation below.

---

## Server: Environment setup

Add `JWT_SECRET` to the Zod schema in `template/server/src/config/env.ts`. This follows the existing pattern: new variables go into the schema object, `safeParse` catches missing or invalid values at startup, and the validated result is exported as `env`.

```typescript
// template/server/src/config/env.ts
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5501),
  CLIENT_URL: z.string().default('http://localhost:5500'),
  // Add this — no default, so it is required in all environments
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
};
```

Update `.env.example` so other developers know the variable is required:

```bash
# template/.env.example
NODE_ENV=development
PORT=5501
CLIENT_URL=http://localhost:5500
VITE_API_URL=http://localhost:5501
VITE_APP_NAME=AppyStack

# Authentication — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=replace-with-a-real-secret-at-least-32-chars
```

In development, add the real value to your local `.env` file (which is gitignored). In production, inject it as an environment variable at runtime — never commit real secrets.

> Note: `console.error` is intentional here. The logger imports `env.ts`, so using the logger here would create a circular dependency. This pattern is already explained in `docs/environment.md`.

---

## Server: Auth routes

Create `template/server/src/routes/auth.ts`. The pattern mirrors `health.ts` and `info.ts`: a `Router`, the `validate` middleware for request bodies, `apiSuccess` for success responses, and `AppError` (thrown and forwarded via `next`) for failure.

```typescript
// template/server/src/routes/auth.ts
import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { apiSuccess } from '../helpers/response.js';
import { env } from '../config/env.js';
import type { ApiResponse } from '@appystack-template/shared';

const router = Router();

// --- Types ---

/** Shape of a decoded JWT payload stored on res.locals after auth middleware runs. */
export interface JwtPayload {
  sub: string;   // user ID
  email: string;
}

/** Returned to the client on successful login. */
export interface AuthTokenResponse {
  token: string;
  expiresIn: number; // seconds
}

// --- Schemas ---

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// --- Helpers ---

const TOKEN_EXPIRY_SECONDS = 60 * 60; // 1 hour

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY_SECONDS });
}

// --- Routes ---

/**
 * POST /api/auth/login
 *
 * Validates credentials and returns a signed JWT on success.
 * Replace the placeholder credential check with your real user lookup.
 */
router.post(
  '/api/auth/login',
  validate({ body: loginSchema }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body as z.infer<typeof loginSchema>;

      // TODO: replace with a real database lookup
      // Example: const user = await UserService.findByEmail(email);
      // if (!user || !await bcrypt.compare(password, user.passwordHash)) { ... }
      const isValidCredentials = email === 'user@example.com' && password === 'password123';
      if (!isValidCredentials) {
        throw new AppError(401, 'Invalid email or password');
      }

      // TODO: use the real user ID from your database
      const payload: JwtPayload = { sub: 'user-id-1', email };
      const token = signToken(payload);

      const response: AuthTokenResponse = { token, expiresIn: TOKEN_EXPIRY_SECONDS };
      apiSuccess(res, response);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/logout
 *
 * JWT is stateless — the server cannot invalidate a token once issued.
 * This endpoint exists as a clear client-side signal to discard the token.
 * For token revocation, implement a server-side blocklist (Redis, database)
 * and check it in the auth middleware before accepting the token.
 */
router.post('/api/auth/logout', (_req, res) => {
  apiSuccess(res, { message: 'Logged out' });
});

export default router;
```

Mount the router in `template/server/src/index.ts`, alongside `healthRouter` and `infoRouter`:

```typescript
// template/server/src/index.ts (additions only)
import authRouter from './routes/auth.js';

// Routes
app.use(healthRouter);
app.use(infoRouter);
app.use(authRouter); // add this line
```

The `/api/auth/login` and `/api/auth/logout` paths live in the route strings themselves, matching the convention used by `health.ts` (`/health`) and `info.ts` (`/api/info`).

---

## Server: Auth middleware

Create `template/server/src/middleware/auth.ts`. This middleware reads the `Authorization: Bearer <token>` header, verifies the token using `jwt.verify()`, and attaches the decoded payload to `res.locals` so downstream route handlers can read the user identity without re-verifying.

```typescript
// template/server/src/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import { env } from '../config/env.js';
import type { JwtPayload } from '../routes/auth.js';

/**
 * Express middleware that enforces JWT authentication.
 *
 * Reads the Bearer token from the Authorization header, verifies it, and
 * attaches the decoded payload to res.locals.user. Throws AppError(401)
 * on any failure so the global errorHandler returns a consistent 401 response.
 *
 * Usage:
 *   import { requireAuth } from '../middleware/auth.js';
 *   router.get('/api/protected', requireAuth, (req, res) => { ... });
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError(401, 'Missing or malformed Authorization header'));
    return;
  }

  const token = authHeader.slice(7); // strip 'Bearer '

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    res.locals.user = payload;
    next();
  } catch {
    // jwt.verify throws JsonWebTokenError, TokenExpiredError, NotBeforeError
    next(new AppError(401, 'Invalid or expired token'));
  }
}
```

`res.locals.user` is the standard Express mechanism for passing data between middleware. It is typed as `any` by default in Express's type definitions, so declare the shape in a module augmentation if you want TypeScript inference throughout your route handlers:

```typescript
// template/server/src/types/express.d.ts
import type { JwtPayload } from '../routes/auth.js';

declare global {
  namespace Express {
    interface Locals {
      user?: JwtPayload;
    }
  }
}
```

---

## Server: Protecting routes

Apply `requireAuth` as route-level middleware. It works identically to `validate` — pass it between the route path and the handler:

```typescript
// Example: template/server/src/routes/profile.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { apiSuccess } from '../helpers/response.js';
import type { JwtPayload } from './auth.js';

const router = Router();

router.get('/api/profile', requireAuth, (req, res) => {
  // res.locals.user is populated by requireAuth
  const user = res.locals.user as JwtPayload;
  apiSuccess(res, { userId: user.sub, email: user.email });
});

export default router;
```

To protect multiple routes in the same file, apply `requireAuth` once at the router level rather than on each individual route:

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Every route in this file requires authentication
router.use(requireAuth);

router.get('/api/items', (req, res) => { /* ... */ });
router.post('/api/items', (req, res) => { /* ... */ });
router.delete('/api/items/:id', (req, res) => { /* ... */ });

export default router;
```

This relies on `AppError` propagating to the global `errorHandler` registered in `index.ts` as the last middleware. That handler formats the 401 response using `isOperational = true` (the default), so the error message is sent to the client. The pattern is already documented in `docs/api-design.md` under "Error Responses".

---

## Server: Socket.io auth

`template/server/src/index.ts` ships with a commented auth guard between lines 70 and 80. The comment shows the shape; here is the complete implementation using `jwt.verify()` from `jsonwebtoken`.

Replace the commented block with this:

```typescript
// template/server/src/index.ts
import jwt from 'jsonwebtoken';
import type { JwtPayload } from './routes/auth.js';

// ...existing imports and setup...

io.on('connection', (socket) => {
  // --- Socket.io auth guard ---
  const token = socket.handshake.auth.token as string | undefined;

  if (!token) {
    logger.warn({ socketId: socket.id }, 'Socket connection rejected: no token');
    socket.disconnect();
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    logger.warn({ socketId: socket.id }, 'Socket connection rejected: invalid token');
    socket.disconnect();
    return;
  }

  // Attach user identity to socket.data — accessible in all event handlers
  socket.data.userId = payload.sub;
  socket.data.email = payload.email;
  // --- End auth guard ---

  logger.info({ socketId: socket.id, userId: socket.data.userId }, 'Client connected');

  socket.on(SOCKET_EVENTS.CLIENT_PING, () => {
    logger.info({ socketId: socket.id }, 'Received client:ping');
    socket.emit(SOCKET_EVENTS.SERVER_PONG, {
      message: 'pong',
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});
```

`socket.data` is Socket.io's built-in per-socket storage — it persists for the duration of the connection and is accessible from any event handler on that socket. It is not typed by default; add a type declaration if needed:

```typescript
// template/server/src/types/socket.d.ts
declare module 'socket.io' {
  interface SocketData {
    userId: string;
    email: string;
  }
}
```

The guard runs synchronously before any event handlers are registered. Disconnecting early with `socket.disconnect(); return;` ensures unauthenticated sockets never enter the handler block and never receive any events.

---

## Client: Token storage

Store the JWT in memory rather than `localStorage`. The `localStorage` attack surface is large — any JavaScript on the page (including third-party scripts and XSS injections) can read `localStorage` without restriction. An in-memory store is only accessible to the same JavaScript module that wrote it, which limits exposure.

The tradeoff: the token is lost on page refresh, so the user must re-authenticate. For most applications this is acceptable. If you need persistence across refreshes, `sessionStorage` is slightly better than `localStorage` (cleared when the tab closes), but still readable by any JavaScript. HttpOnly cookies are the most secure option for persistence; they are inaccessible to JavaScript entirely, but require server-side cookie handling.

Create `template/client/src/utils/tokenStore.ts`:

```typescript
// template/client/src/utils/tokenStore.ts

/**
 * In-memory JWT storage.
 *
 * Storing tokens in localStorage exposes them to XSS — any script on the
 * page can read localStorage. Storing in a module-level variable limits
 * access to code that imports this module.
 *
 * Tradeoff: the token is lost on page refresh. For long-lived sessions,
 * consider HttpOnly cookies (server sets them, JavaScript cannot read them).
 */
let accessToken: string | null = null;

/** Store the JWT returned from POST /api/auth/login. */
export function setToken(token: string): void {
  accessToken = token;
}

/** Read the current JWT. Returns null if not authenticated. */
export function getToken(): string | null {
  return accessToken;
}

/** Clear the JWT on logout or session expiry. */
export function clearToken(): void {
  accessToken = null;
}

/** Returns true if a token is currently stored. */
export function isAuthenticated(): boolean {
  return accessToken !== null;
}
```

Use it after a successful login:

```typescript
import { api } from '../utils/api.js';
import { setToken, clearToken } from '../utils/tokenStore.js';
import type { ApiResponse } from '@appystack-template/shared';
import type { AuthTokenResponse } from '../../../server/src/routes/auth.js'; // or define in shared

async function login(email: string, password: string): Promise<void> {
  const response = await api.post<ApiResponse<AuthTokenResponse>>(
    '/api/auth/login',
    { email, password }
  );
  if (response.data?.token) {
    setToken(response.data.token);
  }
}

async function logout(): Promise<void> {
  await api.post('/api/auth/logout', {});
  clearToken();
}
```

> Tip: define `AuthTokenResponse` in `shared/src/types.ts` rather than importing it from the server package. Shared types are designed for exactly this kind of cross-boundary use.

---

## Client: Sending tokens

Extend the `request()` function in `template/client/src/utils/api.ts` to include the `Authorization` header when a token is available. The change is in one place — all callers of `api.get()` and `api.post()` automatically send the header without any changes to their call sites.

```typescript
// template/client/src/utils/api.ts
import { getToken } from './tokenStore.js';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    ...(options?.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    throw new ApiError(res.status, `Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      signal,
    }),
};

export { ApiError };
```

The header is only added when `getToken()` returns a non-null value, so unauthenticated requests (like `POST /api/auth/login` itself) are unaffected.

If a request returns a 401 (token expired or revoked), catch it at the call site and redirect to the login page:

```typescript
import { ApiError } from '../utils/api.js';
import { clearToken } from '../utils/tokenStore.js';

try {
  const data = await api.get<ApiResponse<Profile>>('/api/profile');
  setProfile(data);
} catch (err) {
  if (err instanceof ApiError && err.status === 401) {
    clearToken();
    // redirect to login
    window.location.href = '/login';
  }
  throw err;
}
```

---

## Client: Socket.io auth

Pass the token via the `auth` option in the `io()` call inside `template/client/src/hooks/useSocket.ts`. Socket.io sends the `auth` object in the handshake before the connection is established, so the server's auth guard runs before any events are processed.

```typescript
// template/client/src/hooks/useSocket.ts
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@appystack-template/shared';
import { getToken } from '../utils/tokenStore.js';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function getSocketUrl(): string {
  return (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? window.location.origin;
}

export function useSocket() {
  const socketRef = useRef<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = getToken();

    const socket: AppSocket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      // Pass token in the Socket.io handshake — read on the server via
      // socket.handshake.auth.token
      auth: { token: token ?? '' },
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
    };
  }, []);

  return { socket: socketRef.current, connected };
}
```

The `auth` option is sent once at connection time. If the token expires mid-session, the socket remains connected — Socket.io does not re-authenticate on reconnect automatically. Handle this by listening for a `disconnect` event with reason `'io server disconnect'` (which means the server deliberately disconnected the socket) and triggering a token refresh or redirect to login:

```typescript
socket.on('disconnect', (reason) => {
  setConnected(false);
  if (reason === 'io server disconnect') {
    // Server disconnected us — token likely expired or revoked
    clearToken();
    window.location.href = '/login';
  }
});
```

---

## Testing

### Testing protected routes with Supertest

The pattern for testing protected routes mirrors the existing tests in `server/src/routes/health.test.ts` and `info.test.ts`. Create a minimal app, mount the router under test, and pass a valid `Authorization` header.

```typescript
// template/server/src/routes/profile.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import profileRouter from './profile.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Use a test secret — env.ts will load JWT_SECRET from process.env,
// which Vitest sets to 'test' for NODE_ENV. Set JWT_SECRET in the test
// environment via .env.test or inline here (tests only).
const TEST_SECRET = 'test-secret-at-least-32-characters-long';

// Override process.env before env.ts module is imported
// (env.ts is already loaded at module init time, so set this in vitest.config.ts
// or use vi.stubEnv in a beforeAll if needed)
process.env.JWT_SECRET = TEST_SECRET;

const app = express();
app.use(express.json());
app.use(profileRouter);
app.use(errorHandler); // required to format AppError responses

function makeToken(payload = { sub: 'user-1', email: 'user@example.com' }): string {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: 3600 });
}

describe('GET /api/profile', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns 200 with a valid token', async () => {
    const token = makeToken();
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('user@example.com');
  });
});
```

> Tip: Set `JWT_SECRET` in `vitest.config.ts` using the `env` option so you do not rely on `process.env` mutation inside tests:
>
> ```typescript
> // server/vitest.config.ts
> import { defineConfig } from 'vitest/config';
>
> export default defineConfig({
>   test: {
>     globals: true,
>     testTimeout: 10000,
>     hookTimeout: 10000,
>     env: {
>       JWT_SECRET: 'test-secret-at-least-32-characters-long',
>     },
>   },
> });
> ```

### Testing the login route

```typescript
// template/server/src/routes/auth.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRouter from './auth.js';
import { errorHandler } from '../middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use(authRouter);
app.use(errorHandler);

describe('POST /api/auth/login', () => {
  it('returns a token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.expiresIn).toBe(3600);
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com' });
    expect(res.status).toBe(400);
  });
});
```

### Testing the auth middleware in isolation

Test `requireAuth` directly by mounting it on a minimal Express app — no need to spin up the full server.

```typescript
// template/server/src/middleware/auth.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from './auth.js';
import { errorHandler } from './errorHandler.js';

const TEST_SECRET = 'test-secret-at-least-32-characters-long';
process.env.JWT_SECRET = TEST_SECRET;

const app = express();
app.use(express.json());

// Mount a test route that uses requireAuth
app.get('/test-protected', requireAuth, (_req, res) => {
  res.json({ status: 'ok', user: res.locals.user });
});
app.use(errorHandler);

describe('requireAuth middleware', () => {
  it('rejects requests with no Authorization header', async () => {
    const res = await request(app).get('/test-protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/missing/i);
  });

  it('rejects requests with a non-Bearer Authorization header', async () => {
    const res = await request(app)
      .get('/test-protected')
      .set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(res.status).toBe(401);
  });

  it('rejects requests with an expired token', async () => {
    const expired = jwt.sign(
      { sub: 'user-1', email: 'user@example.com' },
      TEST_SECRET,
      { expiresIn: -1 } // already expired
    );
    const res = await request(app)
      .get('/test-protected')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it('allows requests with a valid token and attaches the payload', async () => {
    const token = jwt.sign(
      { sub: 'user-1', email: 'user@example.com' },
      TEST_SECRET,
      { expiresIn: 3600 }
    );
    const res = await request(app)
      .get('/test-protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.sub).toBe('user-1');
    expect(res.body.user.email).toBe('user@example.com');
  });
});
```

### Testing Socket.io auth

Use the same real-server pattern from `template/server/src/socket.test.ts` in `docs/socket-io.md`. Pass the token in the `auth` option of the client `io()` call:

```typescript
// template/server/src/socket-auth.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import type { ServerToClientEvents, ClientToServerEvents } from '@appystack-template/shared';

const TEST_SECRET = 'test-secret-at-least-32-characters-long';
process.env.JWT_SECRET = TEST_SECRET;

function makeToken(payload = { sub: 'user-1', email: 'user@example.com' }): string {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: 3600 });
}

describe('Socket.io auth guard', () => {
  let io: Server<ClientToServerEvents, ServerToClientEvents>;
  let serverPort: number;
  let client: ClientSocket;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        const httpServer = createServer();
        io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
          cors: { origin: '*' },
        });

        io.on('connection', (socket) => {
          const token = socket.handshake.auth.token as string | undefined;
          if (!token) {
            socket.disconnect();
            return;
          }
          try {
            jwt.verify(token, TEST_SECRET);
          } catch {
            socket.disconnect();
            return;
          }
          // Authenticated — emit a confirmation event
          socket.emit('server:pong', { message: 'authenticated', timestamp: new Date().toISOString() });
        });

        httpServer.listen(0, () => {
          serverPort = (httpServer.address() as AddressInfo).port;
          resolve();
        });
      })
  );

  afterAll(() => new Promise<void>((resolve) => io.close(() => resolve())));
  afterEach(() => client?.disconnect());

  it('disconnects a client with no token', () => {
    return new Promise<void>((resolve) => {
      client = ioc(`http://localhost:${serverPort}`, {
        forceNew: true,
        transports: ['websocket'],
        // No auth option — server should disconnect immediately
      });
      client.on('disconnect', () => resolve());
    });
  });

  it('disconnects a client with an invalid token', () => {
    return new Promise<void>((resolve) => {
      client = ioc(`http://localhost:${serverPort}`, {
        forceNew: true,
        transports: ['websocket'],
        auth: { token: 'not-a-real-token' },
      });
      client.on('disconnect', () => resolve());
    });
  });

  it('accepts a client with a valid token', () => {
    return new Promise<void>((resolve, reject) => {
      const token = makeToken();
      client = ioc(`http://localhost:${serverPort}`, {
        forceNew: true,
        transports: ['websocket'],
        auth: { token },
      });
      client.on('server:pong', (data) => {
        try {
          expect(data.message).toBe('authenticated');
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      client.on('connect_error', reject);
    });
  });
});
```

---

## Security notes

These are not hypothetical — they are the failure modes that matter in production.

**Use HTTPS in production.** A JWT in an HTTP request is sent in plaintext and can be intercepted. Every AppyStack production deployment should terminate TLS at the load balancer or reverse proxy before traffic reaches Express. The `helmet()` middleware already sets `Strict-Transport-Security`, but only if requests arrive over HTTPS.

**Set a short token expiry.** The example above uses 1 hour (`expiresIn: 3600`). Shorter is better — if a token is stolen, the window during which it can be used is bounded. Adjust based on your application's session requirements.

**Consider refresh tokens for long sessions.** A short-lived access token (15 minutes) paired with a longer-lived refresh token (7 days) gives you the security of short expiry without forcing users to re-authenticate frequently. The access token is stored in memory; the refresh token can be stored in an HttpOnly cookie. On access token expiry, the client silently calls `POST /api/auth/refresh` to get a new access token without user interaction. This pattern is not implemented here — it requires additional routes, a token rotation strategy, and a mechanism to revoke refresh tokens (database table or Redis set). See the [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749) or the [Auth.js documentation](https://authjs.dev) for reference implementations.

**JWT is not suitable for immediate revocation without additional infrastructure.** Once signed, a token is valid until it expires. If a user logs out or their account is suspended, you cannot invalidate their token server-side without a blocklist. A blocklist requires server-side state (Redis or a database table) checked on every authenticated request. If immediate revocation is a requirement, plan for this from the start.

**Never log full token values.** The Pino logger configuration in `server/src/config/logger.ts` does not redact fields automatically. Ensure that JWT strings do not appear in log output — avoid logging `req.headers.authorization` directly.

**Validate `JWT_SECRET` length.** The Zod schema above enforces a minimum of 32 characters. Use a cryptographically random value, not a human-readable string. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Cross-references

- `template/server/src/config/env.ts` — Zod env schema (add `JWT_SECRET` here)
- `template/server/src/middleware/errorHandler.ts` — `AppError` class used in `requireAuth`
- `template/server/src/middleware/validate.ts` — request body validation used in auth routes
- `template/server/src/routes/health.ts` — route pattern reference
- `template/server/src/routes/info.ts` — `apiSuccess` helper usage
- `template/server/src/helpers/response.ts` — `apiSuccess` and `apiFailure` implementations
- `template/server/src/index.ts` — where to mount `authRouter` and complete the Socket.io auth guard
- `template/client/src/utils/api.ts` — extend `request()` to add `Authorization` header
- `template/client/src/hooks/useSocket.ts` — pass token via `auth` option in `io()`
- `template/shared/src/types.ts` — add `AuthTokenResponse` here to share it with the client
- `docs/api-design.md` — REST conventions, error handling, `AppError` usage
- `docs/environment.md` — how to add new environment variables
- `docs/socket-io.md` — Socket.io auth pattern overview and typed event guide
