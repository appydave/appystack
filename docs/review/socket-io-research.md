# Socket.io Best Practices Research for AppyStack Template

Research date: 2026-02-15

## Problem Statement

The current AppyStack template has a gap between its Socket.io type definitions and actual runtime usage:

- **Server** (`server/src/index.ts`): Defines `client:ping` and `server:message` event handlers
- **Shared** (`shared/src/types.ts`): Exports a `SocketEvents` interface with those event signatures
- **Client** (`client/src/hooks/useSocket.ts`): Only tracks `connected` state -- never emits or listens to custom events
- **UI** (`client/src/components/StatusGrid.tsx`): Only reads `connected` boolean, shows no bidirectional proof

The `SocketEvents` type is exported but never consumed at runtime by either client or server. The template proves HTTP works (health check, info endpoint) but does NOT prove WebSocket communication works.

---

## 1. How Do Starter Templates Demonstrate Socket.io?

### What Real Templates Show

**The standard minimal demo is a chat or ping/pong pattern.** Across the templates and tutorials examined, the most common starter demonstrations are:

| Pattern | Frequency | UI Elements |
|---------|-----------|-------------|
| Chat messages (send/receive) | Very common | Text input, message list, send button |
| Ping/pong round-trip | Common | Button to ping, timestamp display |
| Connection status indicator | Universal | Green/red dot |
| Live counter / user count | Occasional | Number display |
| Form field sync (multi-user) | Advanced | Dropdowns, checkboxes, textareas |

**Example: Socket React Fullstack Monorepo** (github.com/yujhenchen/socket-react-fullstack-monorepo)
- Turbo monorepo with `apps/backend` (Express + Socket.io) and `apps/web` (Vite + React)
- Demonstrates: messaging, dropdown sync, checkbox sync, textarea sync, Google Maps position sync, room management, online user count
- This is the "kitchen sink" end of the spectrum -- too much for a starter template

**Example: WeAreAcademy Socket.io React Template** (github.com/WeAreAcademy/socketio-react-template)
- Minimal React + Vite + TypeScript client
- Paired with a separate server template
- Very basic -- just the connection skeleton

### Assessment for AppyStack

The current AppyStack template sits in an awkward middle: it has the server-side event handlers but no client-side proof. A starter template should demonstrate the **minimum viable round-trip**: the user clicks something, the server receives it, processes it, and the client displays the response. The ping/pong pattern already defined in the server code is the right choice -- it just needs the client to complete the loop.

---

## 2. Socket.io + React Hooks Pattern

### Official Socket.io Recommendation (socket.io/how-to/use-with-react)

The official docs recommend a **module-level singleton** pattern, NOT a context provider:

```typescript
// src/socket.ts
import { io } from 'socket.io-client';

const URL = process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:4000';
export const socket = io(URL, { autoConnect: false });
```

```tsx
// App.tsx
import { useState, useEffect } from 'react';
import { socket } from './socket';

export default function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [fooEvents, setFooEvents] = useState([]);

  useEffect(() => {
    function onConnect() { setIsConnected(true); }
    function onDisconnect() { setIsConnected(false); }
    function onFooEvent(value) {
      setFooEvents(previous => [...previous, value]);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('foo', onFooEvent);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('foo', onFooEvent);
    };
  }, []);

  return (/* JSX */);
}
```

Key points from the official guide:
- **Always clean up listeners** in useEffect return -- prevents duplicate registrations
- **Use named functions** so `socket.off()` removes the exact listener
- **autoConnect: false** is recommended so you control when connection starts
- **Do NOT disconnect in useEffect cleanup** with dependencies -- causes reconnect loops

### The `useSocket` Hook Debate: Raw Socket vs Wrapped Events

Three patterns exist in the ecosystem:

**Pattern A: Return raw socket (current AppyStack approach)**
```typescript
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  // ... setup ...
  return { socket: socketRef.current, connected };
}
```
- Pro: Simple, flexible, no abstraction leaks
- Con: Consumers must manage their own event listeners and cleanup
- Con: No type safety on events without manual typing

**Pattern B: Context provider with raw socket**
```tsx
const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }) {
  const [socket] = useState(() => io(URL));
  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error('useSocket must be within SocketProvider');
  return socket;
}
```
- Pro: Single connection shared across component tree
- Con: Extra boilerplate for a template

**Pattern C: Event-specific hooks (socket.io-react-hook library)**
```typescript
const { socket } = useSocket();
const { lastMessage } = useSocketEvent<MessageData>(socket, 'message');
```
- Pro: Clean per-event subscription
- Con: Adds a dependency, may be over-abstracted

### Recommendation for AppyStack

**Use Pattern A (return raw socket) but with proper typing.** A starter template should be transparent about what Socket.io does. Wrapping it in abstractions makes it harder for developers to learn and customize. The official Socket.io docs explicitly show the module-singleton + useEffect pattern, not a context provider.

The current `useSocket` hook is almost right. It needs:
1. Type parameters from the shared package
2. To expose enough for components to emit and listen

---

## 3. Socket.io Authentication Middleware

### Official Pattern (socket.io/docs/v4/middlewares)

**Client sends credentials in the `auth` option:**
```typescript
const socket = io({
  auth: {
    token: "abc"
  }
});

// Or with a function (for dynamic tokens):
const socket = io({
  auth: (cb) => {
    cb({ token: getToken() });
  }
});
```

**Server validates in middleware:**
```typescript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("authentication error"));
  }
  try {
    const decoded = jwt.verify(token, SECRET);
    socket.data.user = decoded;
    next();
  } catch (err) {
    next(new Error("invalid token"));
  }
});
```

**Client handles auth errors:**
```typescript
socket.on("connect_error", (err) => {
  console.log(err.message); // "authentication error" or "invalid token"
});
```

### Alternative: Engine-level middleware (for HTTP-based auth)

```typescript
io.engine.use((req, res, next) => {
  const isHandshake = req._query.sid === undefined;
  if (!isHandshake) return next();

  const header = req.headers["authorization"];
  if (!header) return next(new Error("no token"));
  if (!header.startsWith("bearer ")) return next(new Error("invalid token"));

  const token = header.substring(7);
  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) return next(new Error("invalid token"));
    req.user = decoded.data;
    next();
  });
});
```

### Assessment for AppyStack

**Authentication does NOT belong in the starter template.** The template has no user system, no JWT infrastructure, and no login flow. Adding auth middleware would:
- Add complexity that obscures the Socket.io basics
- Require a JWT secret, token generation, and a user model
- Confuse the purpose of the template (proving the stack works vs. building an app)

However, the `SocketEvents` type definition and the shared package pattern naturally support adding auth later. A `TODO` comment showing where auth middleware would go is appropriate. The actual implementation belongs in consuming apps like FliGen/FliHub.

---

## 4. Socket.io Typed Events (Full Type Safety)

### Official Pattern (socket.io/docs/v4/typescript)

Socket.io v4+ has first-class TypeScript support using interface generics.

**Step 1: Define event interfaces in the shared package**

```typescript
// shared/src/types.ts

/** Events the server sends TO clients */
export interface ServerToClientEvents {
  'server:message': (data: { message: string; timestamp: string }) => void;
  'server:welcome': (data: { socketId: string }) => void;
}

/** Events clients send TO the server */
export interface ClientToServerEvents {
  'client:ping': () => void;
  'client:echo': (message: string) => void;
}

/** Events between servers (clustering) */
export interface InterServerEvents {
  ping: () => void;
}

/** Data attached to each socket instance */
export interface SocketData {
  connectedAt: string;
}
```

**Step 2: Server uses all four type parameters**

```typescript
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
} from '@appystack-template/shared';

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, { /* options */ });

io.on('connection', (socket) => {
  // socket.emit() is now type-safe -- only ServerToClientEvents allowed
  socket.emit('server:welcome', { socketId: socket.id });

  // socket.on() is now type-safe -- only ClientToServerEvents allowed
  socket.on('client:ping', () => {
    socket.emit('server:message', {
      message: 'pong',
      timestamp: new Date().toISOString(),
    });
  });

  // TypeScript ERROR: 'nonexistent' is not in ServerToClientEvents
  // socket.emit('nonexistent', {});
});
```

**Step 3: Client uses reversed type parameters**

```typescript
import { io, Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents
} from '@appystack-template/shared';

// Note: types are in the same order (ServerToClient, ClientToServer)
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  transports: ['websocket', 'polling'],
});

// socket.emit() -- only ClientToServerEvents allowed
socket.emit('client:ping');

// socket.on() -- only ServerToClientEvents allowed
socket.on('server:message', (data) => {
  // data is typed as { message: string; timestamp: string }
  console.log(data.message);
});
```

### Current Problem in AppyStack

The current `SocketEvents` interface conflates both directions into one type:

```typescript
// CURRENT (broken pattern)
export interface SocketEvents {
  'client:ping': () => void;
  'server:message': (data: { message: string; timestamp: string }) => void;
}
```

This cannot be used with Socket.io's generic parameters because the server and client need separate interfaces. The `SocketEvents` type is exported but never passed to `Server<>` or `Socket<>`, so it provides zero type safety at runtime.

### Fix Required

Split `SocketEvents` into `ServerToClientEvents` and `ClientToServerEvents`, then use them as generic parameters on both sides. This is the official Socket.io pattern and provides compile-time enforcement.

---

## 5. Minimum Viable Socket.io Demo for the Template

### What Must Be Proved

A starter template must prove these five things:

1. **Connection works** -- green dot when connected (already done)
2. **Client can emit events** -- a button that sends `client:ping`
3. **Server can receive and respond** -- server logs receipt, emits response (already done on server)
4. **Client can display server responses** -- shows the pong message with timestamp
5. **All type-safe via shared types** -- compile errors if events mismatch

### Proposed Implementation

**shared/src/types.ts**

```typescript
/** Events the server sends TO clients */
export interface ServerToClientEvents {
  'server:pong': (data: { message: string; timestamp: string }) => void;
}

/** Events clients send TO the server */
export interface ClientToServerEvents {
  'client:ping': () => void;
}

/** Inter-server events (for clustering -- placeholder) */
export interface InterServerEvents {
  ping: () => void;
}

/** Per-socket data storage */
export interface SocketData {
  connectedAt: string;
}
```

**server/src/index.ts** (Socket.io section)

```typescript
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@appystack-template/shared';

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: { origin: env.CLIENT_URL, methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');
  socket.data.connectedAt = new Date().toISOString();

  socket.on('client:ping', () => {
    logger.info({ socketId: socket.id }, 'Received ping');
    socket.emit('server:pong', {
      message: 'pong',
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});
```

**client/src/hooks/useSocket.ts**

```typescript
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@appystack-template/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket: TypedSocket = io({
      transports: ['websocket', 'polling'],
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

**client/src/components/SocketDemo.tsx** (NEW -- minimal bidirectional proof)

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';

interface PongMessage {
  message: string;
  timestamp: string;
}

export default function SocketDemo() {
  const { socket, connected } = useSocket();
  const [lastPong, setLastPong] = useState<PongMessage | null>(null);
  const [pingCount, setPingCount] = useState(0);

  useEffect(() => {
    if (!socket) return;

    function onPong(data: PongMessage) {
      setLastPong(data);
    }

    socket.on('server:pong', onPong);

    return () => {
      socket.off('server:pong', onPong);
    };
  }, [socket]);

  const sendPing = useCallback(() => {
    if (!socket) return;
    socket.emit('client:ping');
    setPingCount((c) => c + 1);
  }, [socket]);

  return (
    <div>
      <h3>Socket.io Round-Trip</h3>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      <button onClick={sendPing} disabled={!connected}>
        Send Ping
      </button>
      <p>Pings sent: {pingCount}</p>
      {lastPong && (
        <p>
          Last response: "{lastPong.message}" at{' '}
          {new Date(lastPong.timestamp).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
```

### What This Proves

| Requirement | How It's Met |
|-------------|-------------|
| Connection works | `connected` state, green/red indicator |
| Client can emit | "Send Ping" button calls `socket.emit('client:ping')` |
| Server receives and responds | Server logs receipt, emits `server:pong` |
| Client displays response | Shows pong message and timestamp |
| Type-safe via shared types | `ServerToClientEvents`/`ClientToServerEvents` used as generics |

### What Does NOT Belong in the Template

| Feature | Why Not |
|---------|---------|
| Authentication middleware | No user system, adds complexity |
| Room management | App-specific concern |
| Message persistence | Requires a database |
| Rate limiting | App-specific concern |
| Custom namespaces | App-specific concern |
| Context provider pattern | Over-engineering for a template |
| Third-party hook libraries | Adds dependencies, hides the pattern |

---

## Summary of Changes Needed

### Must Fix (the template is misleading without these)

1. **Split `SocketEvents` into `ServerToClientEvents` and `ClientToServerEvents`** in `shared/src/types.ts`
2. **Type the Socket.io Server** with generic parameters in `server/src/index.ts`
3. **Type the client Socket** with generic parameters in `client/src/hooks/useSocket.ts`
4. **Add a UI element** (button + display) that demonstrates the ping/pong round-trip
5. **Rename `server:message` to `server:pong`** for clarity (or keep it, but the name should reflect the demo)

### Nice to Have (but not blocking)

6. Add a `TODO` comment in `server/src/index.ts` showing where auth middleware would go
7. Add `InterServerEvents` and `SocketData` interfaces (even as empty placeholders) for completeness
8. Consider `autoConnect: false` on the client socket with explicit `socket.connect()` in the component

---

## Sources

- [Socket.io TypeScript Documentation](https://socket.io/docs/v4/typescript/) -- Official typed events guide
- [Socket.io How to Use with React](https://socket.io/how-to/use-with-react) -- Official React integration guide
- [Socket.io Middlewares](https://socket.io/docs/v4/middlewares/) -- Official middleware/auth documentation
- [Socket.io How to Use with JWT](https://socket.io/how-to/use-with-jwt) -- Official JWT auth guide
- [socket.io-react-hook (npm)](https://www.npmjs.com/package/socket.io-react-hook) -- Third-party React hooks library
- [Socket React Fullstack Monorepo (GitHub)](https://github.com/yujhenchen/socket-react-fullstack-monorepo) -- Turbo monorepo example
- [WeAreAcademy Socket.io React Template (GitHub)](https://github.com/WeAreAcademy/socketio-react-template) -- Minimal starter template
- [Socket.io Monorepo Blog Post](https://socket.io/blog/monorepo/) -- Socket.io's own monorepo structure
- [CS4530 Spring 2025 Socket.io Tutorial](https://neu-se.github.io/CS4530-Spring-2025/tutorials/week5-socketio-basics) -- University tutorial with TypeScript examples
