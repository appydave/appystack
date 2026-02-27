# First Feature: End-to-End Walkthrough

> A concrete walkthrough for adding a real feature to an AppyStack app. This guide builds a **message board** — users post messages and see them appear in real time across all connected clients.

The pattern followed here is the same one you will repeat for every feature: shared types first, then server, then client, then tests. Each section references the relevant guide for deeper context.

---

## What We Are Building

A minimal message board with:

- `POST /api/messages` — create a message (REST, with Zod validation)
- `GET /api/messages` — retrieve all messages (REST)
- `messages:new` Socket.io event — broadcast a new message to all connected clients in real time
- `useMessages` React hook — fetches the message list and subscribes to live updates
- A `MessageBoard` component that renders the list and a submit form

---

## Step 1 — Define Shared Types

Everything starts in `shared/src/types.ts`. Define the data shape once; both the server and client import from it.

```typescript
// shared/src/types.ts

/** A single message posted to the board. */
export interface Message {
  id: string;
  author: string;
  text: string;
  createdAt: string; // ISO 8601
}

/** Request body for POST /api/messages. */
export interface CreateMessageBody {
  author: string;
  text: string;
}
```

The `ApiResponse<T>` wrapper is already in `types.ts` — you do not need to add it. The server will wrap `Message` and `Message[]` in it automatically.

**Why shared types first?** TypeScript will catch any mismatch between what the server sends and what the client expects at compile time, not at runtime. Defining the contract up front means both sides stay in sync automatically.

---

## Step 2 — Add Socket Event Constants

Add the new event names to `shared/src/constants.ts`. Never write event name string literals directly in server or client code — use this map everywhere.

```typescript
// shared/src/constants.ts

export const SOCKET_EVENTS = {
  CLIENT_PING: 'client:ping',
  SERVER_PONG: 'server:pong',
  MESSAGES_NEW: 'messages:new',  // ← add this
} as const;
```

Then register the event in `shared/src/types.ts` so Socket.io's generics enforce the payload shape:

```typescript
// shared/src/types.ts

export interface ServerToClientEvents {
  'server:pong': (data: { message: string; timestamp: string }) => void;
  'messages:new': (message: Message) => void;  // ← add this
}

// ClientToServerEvents stays the same — clients only receive, not send, for this feature
```

See [socket-io.md](./socket-io.md) for the full explanation of how the generic wiring works and why `as const` matters.

---

## Step 3 — Add the Server Route

Create `server/src/routes/messages.ts`. The route file creates a Router, registers the handlers, and exports it as the default — the same pattern used by `health.ts` and `info.ts`.

```typescript
// server/src/routes/messages.ts
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { apiSuccess } from '../helpers/response.js';
import type { ApiResponse, Message } from '@appystack-template/shared';

const router = Router();

// In-memory store for this walkthrough.
// Replace with a real DB call — see database.md for where that layer lives.
const messages: Message[] = [];

const createMessageSchema = z.object({
  author: z.string().min(1, 'Author is required').max(50),
  text: z.string().min(1, 'Message text is required').max(500),
});

router.post(
  '/api/messages',
  validate({ body: createMessageSchema }),
  (req, res) => {
    const message: Message = {
      id: crypto.randomUUID(),
      author: req.body.author as string,
      text: req.body.text as string,
      createdAt: new Date().toISOString(),
    };
    messages.push(message);
    res.status(201).json({
      status: 'ok',
      data: message,
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse<Message>);
  }
);

router.get('/api/messages', (_req, res) => {
  apiSuccess(res, messages);
});

export default router;
```

Key points:

- `validate({ body: createMessageSchema })` runs before the handler. On a `ZodError` it automatically returns a `400` with the field errors — you do not write any validation logic in the handler. See [api-design.md](./api-design.md#request-validation-with-zod) for the full pattern.
- `AppError` is available for any business-logic errors you want to surface (e.g., `throw new AppError(404, 'Message not found')`). See [api-design.md](./api-design.md#error-responses).
- `crypto.randomUUID()` is available without imports in Node 20+.
- The `satisfies` keyword gives TypeScript a full structural check on the response literal.

Mount the router in `server/src/index.ts` after the existing routes:

```typescript
// server/src/index.ts
import messagesRouter from './routes/messages.js';

// After existing app.use(healthRouter) and app.use(infoRouter):
app.use(messagesRouter);
```

---

## Step 4 — Add the Socket.io Broadcast

The server needs to emit `messages:new` to all connected clients when a message is created. Because `io` is defined in `index.ts`, the cleanest approach for a simple feature is to pass `io` as a parameter to a handler factory, or to import it directly if you keep `io` in a separate module.

For this walkthrough, pass `io` into the router factory:

```typescript
// server/src/routes/messages.ts (updated)
import { Router } from 'express';
import { z } from 'zod';
import type { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@appystack-template/shared';
import { SOCKET_EVENTS } from '@appystack-template/shared';
import { validate } from '../middleware/validate.js';
import { apiSuccess } from '../helpers/response.js';
import type { ApiResponse, Message } from '@appystack-template/shared';

const messages: Message[] = [];

const createMessageSchema = z.object({
  author: z.string().min(1).max(50),
  text: z.string().min(1).max(500),
});

export function createMessagesRouter(
  io: Server<ClientToServerEvents, ServerToClientEvents>
) {
  const router = Router();

  router.post(
    '/api/messages',
    validate({ body: createMessageSchema }),
    (req, res) => {
      const message: Message = {
        id: crypto.randomUUID(),
        author: req.body.author as string,
        text: req.body.text as string,
        createdAt: new Date().toISOString(),
      };
      messages.push(message);

      // Broadcast to all connected socket clients
      io.emit(SOCKET_EVENTS.MESSAGES_NEW, message);

      res.status(201).json({
        status: 'ok',
        data: message,
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<Message>);
    }
  );

  router.get('/api/messages', (_req, res) => {
    apiSuccess(res, messages);
  });

  return router;
}
```

Update the mount in `index.ts` to pass `io`:

```typescript
// server/src/index.ts
import { createMessagesRouter } from './routes/messages.js';

// After io is defined and before the 404 catch-all:
app.use(createMessagesRouter(io));
```

`io.emit` sends to every connected client. `socket.emit` (inside a connection handler) sends only to the sender. See [socket-io.md](./socket-io.md#step-by-step-adding-a-new-typed-event) for when to use rooms vs. broadcast.

---

## Step 5 — Add the Client Hook

Create `client/src/hooks/useMessages.ts`. The hook combines an initial REST fetch (via the `api` utility) with a Socket.io subscription for live updates.

```typescript
// client/src/hooks/useMessages.ts
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../utils/api.js';
import type { AppSocket } from './useSocket.js';
import { SOCKET_EVENTS } from '@appystack-template/shared';
import type { ApiResponse, Message, CreateMessageBody } from '@appystack-template/shared';

export function useMessages(socket: AppSocket | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load — fetch existing messages from REST
  useEffect(() => {
    const controller = new AbortController();

    api
      .get<ApiResponse<Message[]>>('/api/messages', controller.signal)
      .then((res) => {
        setMessages(res.data ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiError || err instanceof Error) {
          if (err.name !== 'AbortError') setError(err.message);
        }
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  // Real-time subscription — append new messages as they arrive
  useEffect(() => {
    if (!socket) return;

    const handleNew = (message: Message) => {
      setMessages((prev) => [...prev, message]);
    };

    socket.on(SOCKET_EVENTS.MESSAGES_NEW, handleNew);

    // Always clean up — socket.off needs the exact same function reference
    return () => {
      socket.off(SOCKET_EVENTS.MESSAGES_NEW, handleNew);
    };
  }, [socket]);

  // Post a new message via REST; the server broadcasts it, so the socket
  // subscription above handles the UI update — no manual state mutation needed
  const postMessage = useCallback(
    async (body: CreateMessageBody): Promise<void> => {
      await api.post<ApiResponse<Message>>('/api/messages', body);
    },
    []
  );

  return { messages, loading, error, postMessage };
}
```

Notes on this pattern:

- The initial load uses `api.get` from `client/src/utils/api.ts`, which throws `ApiError` on non-2xx responses and handles the `VITE_API_URL` base automatically. See [api-design.md](./api-design.md#using-the-typed-api-wrapper-from-the-client).
- The socket subscription uses `socket.off` with the same `handleNew` reference. Inline arrow functions cannot be removed — defining the handler inside the effect (before `socket.on`) is the correct pattern. See [socket-io.md](./socket-io.md#forgetting-to-remove-listeners).
- `postMessage` does not update local state directly. The server broadcasts `messages:new` after a successful POST, and the socket subscription appends it. This means a second browser tab also sees the update — it is genuinely real time.

---

## Step 6 — Wire into a Component

```tsx
// client/src/components/MessageBoard.tsx
import { useState } from 'react';
import { useSocket } from '../hooks/useSocket.js';
import { useMessages } from '../hooks/useMessages.js';

export function MessageBoard() {
  const { socket, connected } = useSocket();
  const { messages, loading, error, postMessage } = useMessages(socket);
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!author.trim() || !text.trim()) return;
    setSubmitting(true);
    try {
      await postMessage({ author: author.trim(), text: text.trim() });
      setText('');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading messages...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className={connected ? 'text-green-500' : 'text-red-500'}>
          {connected ? 'Live' : 'Disconnected'}
        </span>
        <span>{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
      </div>

      <ul className="space-y-2">
        {messages.map((m) => (
          <li key={m.id} className="rounded border p-3">
            <p className="font-semibold">{m.author}</p>
            <p>{m.text}</p>
            <p className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleTimeString()}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Your name"
          className="w-full rounded border px-3 py-2"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message..."
          className="w-full rounded border px-3 py-2"
          rows={3}
        />
        <button
          type="submit"
          disabled={submitting || !connected}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'Posting...' : 'Post Message'}
        </button>
      </form>
    </div>
  );
}
```

Render it in a page:

```tsx
// client/src/pages/MessageBoardPage.tsx
import { MessageBoard } from '../components/MessageBoard.js';

export function MessageBoardPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Message Board</h1>
      <MessageBoard />
    </main>
  );
}
```

---

## Step 7 — Write the Tests

### Server route test (Supertest)

Mount the router on a minimal Express app and drive it with Supertest. Because `createMessagesRouter` now requires an `io` argument, pass a minimal mock — the test only verifies HTTP behavior.

```typescript
// server/src/routes/messages.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { createMessagesRouter } from './messages.js';

function buildApp() {
  const app = express();
  app.use(express.json());

  // Minimal io mock — we are testing HTTP, not socket emissions
  const ioMock = { emit: vi.fn() } as unknown as Parameters<typeof createMessagesRouter>[0];
  app.use(createMessagesRouter(ioMock));
  app.use(errorHandler);
  return { app, ioMock };
}

describe('GET /api/messages', () => {
  it('returns 200 with an empty array on a fresh instance', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/messages');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/messages', () => {
  it('creates a message and returns 201', async () => {
    const { app, ioMock } = buildApp();
    const res = await request(app)
      .post('/api/messages')
      .send({ author: 'Alice', text: 'Hello world' });

    expect(res.status).toBe(201);
    expect(res.body.data.author).toBe('Alice');
    expect(res.body.data.text).toBe('Hello world');
    expect(res.body.data.id).toBeDefined();
    expect(ioMock.emit).toHaveBeenCalledOnce();
  });

  it('returns 400 when author is missing', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/messages')
      .send({ text: 'Missing author' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when text is empty', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/messages')
      .send({ author: 'Alice', text: '' });

    expect(res.status).toBe(400);
  });
});
```

See [testing-guide.md](./testing-guide.md#route-tests--supertest) for the full Supertest setup pattern, including how to attach `errorHandler` for middleware tests.

### Client hook test (renderHook)

Test `useMessages` in isolation by mocking the `api` utility and the socket. This avoids spinning up a real server for the unit test.

```typescript
// client/src/hooks/useMessages.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMessages } from './useMessages.js';

// Mock the api module before importing anything that uses it
vi.mock('../utils/api.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
}));

import { api } from '../utils/api.js';

const mockMessages = [
  { id: '1', author: 'Alice', text: 'Hello', createdAt: '2026-01-01T00:00:00.000Z' },
];

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ status: 'ok', data: mockMessages, timestamp: '' });
  vi.mocked(api.post).mockResolvedValue({ status: 'ok', data: mockMessages[0], timestamp: '' });
});

describe('useMessages', () => {
  it('fetches messages on mount', async () => {
    const { result } = renderHook(() => useMessages(null));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].author).toBe('Alice');
  });

  it('appends a message when the socket emits messages:new', async () => {
    const listeners: Record<string, (data: unknown) => void> = {};
    const mockSocket = {
      on: vi.fn((event: string, cb: (data: unknown) => void) => { listeners[event] = cb; }),
      off: vi.fn(),
    } as unknown as Parameters<typeof useMessages>[0];

    const { result } = renderHook(() => useMessages(mockSocket));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newMessage = { id: '2', author: 'Bob', text: 'Hi', createdAt: '2026-01-01T00:01:00.000Z' };
    listeners['messages:new'](newMessage);

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(result.current.messages[1].author).toBe('Bob');
  });
});
```

See [testing-guide.md](./testing-guide.md#hook-testing-with-renderhook) for patterns around hooks that make real fetch calls against a test server, and [testing-guide.md](./testing-guide.md#mocking-hooks-in-component-tests) for the `vi.hoisted` pattern when mocking hooks in component tests.

---

## Summary

| Step | File | What you did |
|---|---|---|
| 1 | `shared/src/types.ts` | Added `Message` and `CreateMessageBody` interfaces |
| 2 | `shared/src/constants.ts` and `types.ts` | Added `MESSAGES_NEW` event constant and socket type |
| 3 | `server/src/routes/messages.ts` | REST endpoints with Zod validation |
| 4 | `server/src/routes/messages.ts` + `index.ts` | Socket.io broadcast on POST |
| 5 | `client/src/hooks/useMessages.ts` | Hook combining REST fetch and socket subscription |
| 6 | `client/src/components/MessageBoard.tsx` | Component wired to the hook |
| 7 | `*.test.ts` | Supertest route tests + `renderHook` hook tests |

The pattern is the same for any feature you add: shared contract first, server second, client third, tests alongside each.

---

## Cross-references

- [api-design.md](./api-design.md) — Route structure, Zod validation, `AppError`, `ApiResponse<T>`, the `api` utility
- [socket-io.md](./socket-io.md) — Typed events, `SOCKET_EVENTS` constants, listener cleanup, socket auth
- [testing-guide.md](./testing-guide.md) — Supertest, `renderHook`, `vi.hoisted`, MSW, socket testing
