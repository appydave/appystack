# Socket.io

> How typed Socket.io events work in the RVETS template — from shared type definitions through server handlers, client hooks, testing, and common pitfalls.

## Overview

The template uses Socket.io with TypeScript generics so the compiler enforces event names and payload shapes on both server and client. All event definitions live in the shared package:

- `template/shared/src/types.ts` — `ServerToClientEvents` / `ClientToServerEvents` interfaces
- `template/shared/src/constants.ts` — `SOCKET_EVENTS` constant map
- `template/server/src/index.ts` — server-side `io.on('connection', ...)` handler
- `template/client/src/hooks/useSocket.ts` — React hook that owns the socket lifecycle

## How Typed Socket Events Work

`template/shared/src/types.ts` declares two interfaces that Socket.io's generics consume:

```typescript
// template/shared/src/types.ts

export interface ServerToClientEvents {
  'server:pong': (data: { message: string; timestamp: string }) => void;
}

export interface ClientToServerEvents {
  'client:ping': () => void;
}
```

`ServerToClientEvents` — events the **server emits**, the **client listens** for.
`ClientToServerEvents` — events the **client emits**, the **server listens** for.

### Wiring the generics

The server generic order is `<listen, emit>` — reversed from the interface names:

```typescript
// template/server/src/index.ts
import { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@appystack-template/shared';

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, { ... });
```

The client mirrors the server:

```typescript
// template/client/src/hooks/useSocket.ts
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@appystack-template/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
```

TypeScript rejects any `socket.emit` call not in `ClientToServerEvents` and infers payload types for every `socket.on` call.

### Event name constants

String literals typed separately in two places create silent runtime mismatches. The template provides a constants map:

```typescript
// template/shared/src/constants.ts
export const SOCKET_EVENTS = {
  CLIENT_PING: 'client:ping',
  SERVER_PONG: 'server:pong',
} as const;
```

Always import `SOCKET_EVENTS` instead of writing string literals. The `as const` assertion narrows each value to a literal type, satisfying the interface key constraint.

---

## Step-by-Step: Adding a New Typed Event

This walkthrough adds `chat:send` (client → server) and `chat:message` (server → all clients).

### 1. Add types to shared

```typescript
// template/shared/src/types.ts
export interface ServerToClientEvents {
  'server:pong': (data: { message: string; timestamp: string }) => void;
  'chat:message': (data: { from: string; text: string; timestamp: string }) => void;
}

export interface ClientToServerEvents {
  'client:ping': () => void;
  'chat:send': (payload: { text: string }) => void;
}
```

### 2. Add constants

```typescript
// template/shared/src/constants.ts
export const SOCKET_EVENTS = {
  CLIENT_PING: 'client:ping',
  SERVER_PONG: 'server:pong',
  CHAT_SEND: 'chat:send',
  CHAT_MESSAGE: 'chat:message',
} as const;
```

### 3. Handle on the server

```typescript
// template/server/src/index.ts
io.on('connection', (socket) => {
  socket.on(SOCKET_EVENTS.CHAT_SEND, (payload) => {
    // payload is typed: { text: string }
    io.emit(SOCKET_EVENTS.CHAT_MESSAGE, {
      from: socket.id ?? 'unknown',
      text: payload.text,
      timestamp: new Date().toISOString(),
    });
  });
});
```

`io.emit` broadcasts to all clients; `socket.emit` sends only to the sender.

### 4. Create a client hook

```typescript
// template/client/src/hooks/useChat.ts
import { useEffect, useState, useCallback } from 'react';
import type { AppSocket } from './useSocket';
import { SOCKET_EVENTS } from '@appystack-template/shared';

interface ChatMessage { from: string; text: string; timestamp: string; }

export function useChat(socket: AppSocket | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!socket) return;
    const handleMessage = (data: ChatMessage) => setMessages((prev) => [...prev, data]);
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, handleMessage);
    return () => { socket.off(SOCKET_EVENTS.CHAT_MESSAGE, handleMessage); };
  }, [socket]);

  const sendMessage = useCallback(
    (text: string) => { socket?.emit(SOCKET_EVENTS.CHAT_SEND, { text }); },
    [socket],
  );
  return { messages, sendMessage };
}
```

### 5. Use in a component

```typescript
// template/client/src/components/ChatPanel.tsx
import { useSocket } from '../hooks/useSocket';
import { useChat } from '../hooks/useChat';

export function ChatPanel() {
  const { socket, connected } = useSocket();
  const { messages, sendMessage } = useChat(socket);
  return (
    <div>
      <ul>{messages.map((m) => <li key={m.timestamp}>{m.text}</li>)}</ul>
      <button disabled={!connected} onClick={() => sendMessage('hello')}>Send</button>
    </div>
  );
}
```

---

## Testing Socket Events

### Unit/integration: template/server/src/socket.test.ts

Spins up a real `http.Server` on port 0, attaches Socket.io, connects a real client, and asserts events fire with correct payloads. The full test file is at `template/server/src/socket.test.ts`. The core pattern:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@appystack-template/shared';
import { SOCKET_EVENTS } from '@appystack-template/shared';

describe('Socket.io event handlers', () => {
  let io: Server<ClientToServerEvents, ServerToClientEvents>;
  let serverPort: number;
  let client: ClientSocket<ServerToClientEvents, ClientToServerEvents>;

  beforeAll(() => new Promise<void>((resolve) => {
    const httpServer = createServer();
    io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, { cors: { origin: '*' } });
    io.on('connection', (socket) => {
      socket.on(SOCKET_EVENTS.CLIENT_PING, () => {
        socket.emit(SOCKET_EVENTS.SERVER_PONG, { message: 'pong', timestamp: new Date().toISOString() });
      });
    });
    // Port 0 → OS picks a free port, preventing EADDRINUSE across parallel test files
    httpServer.listen(0, () => { serverPort = (httpServer.address() as AddressInfo).port; resolve(); });
  }));

  afterAll(() => new Promise<void>((resolve) => { io.close(() => resolve()); }));
  afterEach(() => { client?.disconnect(); });

  it('receives server:pong when client:ping is emitted', () => {
    return new Promise<void>((resolve, reject) => {
      client = ioc(`http://localhost:${serverPort}`, { forceNew: true, transports: ['websocket'] });

      // Wrap assertions in try/catch — uncaught async errors don't fail tests otherwise
      client.on(SOCKET_EVENTS.SERVER_PONG, (data) => {
        try { expect(data.message).toBe('pong'); resolve(); } catch (err) { reject(err); }
      });
      client.on('connect', () => { client.emit(SOCKET_EVENTS.CLIENT_PING); });
      client.on('connect_error', reject); // always handle to surface connection failures
    });
  });
});
```

### E2E: template/e2e/socket.test.ts

The Playwright test starts the full dev stack and drives the browser through the ping-pong UI. It waits for the Send Ping button to be enabled (socket connected), clicks it, and asserts the pong response text is visible. This validates the full round-trip including the Vite proxy that forwards `/socket.io` to the Express server.

---

## Common Pitfalls

### Event name mismatches

Without constants, a typo in a string literal fails silently at runtime:

```typescript
// Server emits with capital P — no TypeScript error if generics are missing
socket.emit('server:Pong', data);

// Client listens for lowercase p — never fires
socket.on('server:pong', handler);
```

Prevention: use `SOCKET_EVENTS` constants from `@appystack-template/shared` everywhere. TypeScript will catch mismatches against the interface keys.

### Forgetting to remove listeners

Adding a listener without a cleanup function accumulates listeners on each re-mount:

```typescript
// Bad — listener is never removed
useEffect(() => {
  socket?.on(SOCKET_EVENTS.CHAT_MESSAGE, handleMessage);
}, [socket]);

// Good — cleanup removes the exact same function reference
useEffect(() => {
  if (!socket) return;
  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, handleMessage);
  return () => {
    socket.off(SOCKET_EVENTS.CHAT_MESSAGE, handleMessage);
  };
}, [socket]);
```

`socket.off` requires the same function reference. Define `handleMessage` with `useCallback` or inside the effect before registering — do not pass an inline arrow function to `socket.on` if you intend to remove it.

### Forgetting socket.disconnect() on unmount

`template/client/src/hooks/useSocket.ts` already handles this in its cleanup:

```typescript
return () => {
  socket.disconnect();
};
```

If you create a socket outside `useSocket`, ensure `socket.disconnect()` is called in the `useEffect` cleanup. Failing to do so leaves the socket open and triggers reconnect loops after the component unmounts.

---

## Reconnection Behaviour

Socket.io reconnects automatically (exponential backoff, unlimited attempts by default). Override in `useSocket.ts` by passing `reconnectionAttempts`, `reconnectionDelay`, and `reconnectionDelayMax` to `io(...)`. Environment-specific config belongs in the env layer — see `template/server/src/config/env.ts` and `docs/architecture.md`.

---

## Socket Auth Pattern

`template/server/src/index.ts` ships a commented auth guard (added Wave 3, WU-12). The pattern reads `socket.handshake.auth.token`, verifies it, and calls `socket.disconnect(); return;` on failure before any other handler runs:

```typescript
// template/server/src/index.ts
io.on('connection', (socket) => {
  // const token = socket.handshake.auth.token as string | undefined;
  // if (!token) { socket.disconnect(); return; }
  // try {
  //   const payload = verifyToken(token);   // replace with your JWT verify
  //   socket.data.userId = payload.sub;
  // } catch { socket.disconnect(); return; }
});
```

The client passes the token as:

```typescript
const socket = io({ auth: { token: getAccessToken() } });
```

---

## Debugging

### Enable client debug logging

In the browser DevTools console:

```javascript
localStorage.debug = 'socket.io-client:*';
```

Reload the page. The console logs every packet, transport upgrades (polling → websocket), reconnect attempts, and errors.

To disable: `localStorage.removeItem('socket.io-client:*');`

### What to look for

| Log entry | Meaning |
|---|---|
| `socket.io-client:manager polling` | Using HTTP polling, not yet upgraded |
| `socket.io-client:manager connect` | WebSocket upgrade succeeded |
| `socket.io-client:socket emit [event]` | Client sent an event |
| `socket.io-client:socket receive [event]` | Client received an event |
| `socket.io-client:manager reconnecting` | Lost connection, retrying |

### Server-side

The server logs socket lifecycle with Pino — look for `"Client connected"`, `"Received client:ping"`, and `"Client disconnected"` entries with `socketId`. Set `LOG_LEVEL=debug` for verbose output (config: `template/server/src/config/logger.ts`). If the socket connects in production but not development, verify the Vite proxy target in `template/client/vite.config.ts` matches `5501`.

---

## Cross-references

- `docs/architecture.md` — RVETS architecture, deployment notes, environment variable matrix
- `template/shared/src/types.ts` — `ServerToClientEvents` / `ClientToServerEvents`
- `template/shared/src/constants.ts` — `SOCKET_EVENTS` constant map
- `template/server/src/index.ts` — socket handler and commented auth pattern
- `template/server/src/socket.test.ts` — unit/integration socket tests
- `template/e2e/socket.test.ts` — Playwright end-to-end socket test
- `template/client/src/hooks/useSocket.ts` — React socket lifecycle hook
- `template/server/src/config/env.ts` — environment validation with Zod
