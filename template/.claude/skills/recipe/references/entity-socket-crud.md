# Recipe: Entity Socket CRUD

All CRUD operations for any entity flow through a generic `entity:{operation}` Socket.io contract. No bespoke socket handlers per entity — one contract, all entities. Discovered in Signal Studio, a real production app built on AppyStack.

This recipe documents the client-side hook and server-side handler pattern that makes multi-entity CRUD apps work cleanly. It sits on top of the `file-crud` recipe (which provides `fileStore.ts`, `idgen.ts`, and `watcher.ts`).

---

## Recipe Anatomy

**Intent**
Provide a single Socket.io event contract that handles list, get, save, and delete for any entity. No per-entity socket boilerplate on the client. One `useEntity` hook works for every entity in the app.

**Type**: Additive. Can be applied to an existing app that already has `file-crud` infrastructure. Safe to run entity-by-entity.

**Stack Assumptions**
- AppyStack RVETS template (Express 5, Socket.io, TypeScript, React 19)
- `file-crud` recipe already applied (`server/src/data/fileStore.ts` exists)
- `client/src/lib/entitySocket.ts` singleton already in template

**Idempotency Check**
Does `client/src/hooks/useEntity.ts` exist? If yes → hook is already installed. Only generate new `server/src/sockets/{entity}Handlers.ts` files for new entities.

**Does Not Touch**
- `fileStore.ts` — provided by `file-crud` recipe
- `watcher.ts` — chokidar watcher from `file-crud` recipe
- Authentication or authorization
- Client-side view components (views are the developer's concern or `nav-shell` recipe's output)

**Composes With**
- `file-crud` — provides the persistence layer this recipe calls into
- `nav-shell` — each entity gets a nav item; views use `useEntity` hook
- All three together = complete multi-entity CRUD app

---

## Socket Event Contract

This is the complete, canonical event spec. No entity-specific events exist outside this contract.

**Client → Server (commands)**

| Event | Payload | Description |
|-------|---------|-------------|
| `entity:list` | `{ entity: string }` | Fetch all records for an entity |
| `entity:get` | `{ entity: string; id: string }` | Fetch a single record by ID |
| `entity:save` | `{ entity: string; record: Record<string, unknown> }` | Create (no id) or update (with id) |
| `entity:delete` | `{ entity: string; id: string }` | Delete a record by ID |

**Server → Client (responses)**

| Event | Payload | Sent to |
|-------|---------|---------|
| `entity:list:result` | `{ entity: string; records: unknown[] }` | Requesting socket only |
| `entity:get:result` | `{ entity: string; record: unknown }` | Requesting socket only |
| `entity:created` | `{ entity: string; record: unknown }` | All connected clients (broadcast) |
| `entity:updated` | `{ entity: string; record: unknown }` | All connected clients (broadcast) |
| `entity:deleted` | `{ entity: string; id: string }` | All connected clients (broadcast) |
| `entity:external-change` | `{ entity: string }` | All connected clients (chokidar triggered) |
| `entity:error` | `{ entity: string; operation: string; message: string }` | Requesting socket only |

`entity:created` and `entity:updated` are **separate events** — the client UI treats them differently (scroll to new record, highlight on update, different toast messages).

---

## Files to Create

```
project-root/
├── server/src/sockets/
│   └── {entity}Handlers.ts     ← one per entity, all follow same structure
├── client/src/lib/
│   └── entitySocket.ts         ← singleton (already in template — do not recreate)
└── client/src/hooks/
    └── useEntity.ts            ← generic hook (one file, works for all entities)
```

---

## Server Handler Template

One file per entity. Copy this, change `ENTITY` and the function name. All handlers follow this exact structure with try-catch.

```typescript
// server/src/sockets/companyHandlers.ts
import type { Server, Socket } from 'socket.io';
import { listRecords, getRecord, saveRecord, deleteRecord } from '../data/fileStore.js';

const ENTITY = 'companies'; // change per entity

export function registerCompanyHandlers(io: Server, socket: Socket): void {
  socket.on('entity:list', async (payload) => {
    if (payload?.entity !== ENTITY) return;
    try {
      const records = await listRecords(ENTITY);
      socket.emit('entity:list:result', { entity: ENTITY, records });
    } catch (err) {
      socket.emit('entity:error', { entity: ENTITY, operation: 'list', message: String(err) });
    }
  });

  socket.on('entity:get', async (payload) => {
    if (payload?.entity !== ENTITY) return;
    try {
      const record = await getRecord(ENTITY, payload.id);
      socket.emit('entity:get:result', { entity: ENTITY, record });
    } catch (err) {
      socket.emit('entity:error', { entity: ENTITY, operation: 'get', message: String(err) });
    }
  });

  socket.on('entity:save', async (payload) => {
    if (payload?.entity !== ENTITY) return;
    try {
      const saved = await saveRecord(ENTITY, payload.record);
      io.emit('entity:updated', { entity: ENTITY, record: saved });
    } catch (err) {
      socket.emit('entity:error', { entity: ENTITY, operation: 'save', message: String(err) });
    }
  });

  socket.on('entity:delete', async (payload) => {
    if (payload?.entity !== ENTITY) return;
    try {
      await deleteRecord(ENTITY, payload.id);
      io.emit('entity:deleted', { entity: ENTITY, id: payload.id });
    } catch (err) {
      socket.emit('entity:error', { entity: ENTITY, operation: 'delete', message: String(err) });
    }
  });
}
```

**Mount in `server/src/index.ts`:**

```typescript
import { registerCompanyHandlers } from './sockets/companyHandlers.js';
import { registerSiteHandlers } from './sockets/siteHandlers.js';

io.on('connection', (socket) => {
  registerCompanyHandlers(io, socket);
  registerSiteHandlers(io, socket);
  // add more entities here
});
```

---

## Client: entitySocket.ts Singleton

The singleton is already in the template at `client/src/lib/entitySocket.ts`. Do not recreate it.

**Pattern**: a module-scoped `Socket | null` variable with a `getEntitySocket()` function that lazily creates a single Socket.io connection on first call. All hooks share this connection. This is what prevents duplicate connections when multiple components use `useEntity`.

If the file is missing for any reason, create one that exports `getEntitySocket(): Socket` using lazy initialization with `io()` from `socket.io-client`.

---

## Client: useEntity Hook Contract

One hook handles all entities. The hook is generic over the entity type `T`.

**Interface**

```typescript
export interface UseEntityResult<T> {
  records: T[];
  loading: boolean;
  entityError: string | null;
  saveRecord: (record: Partial<T>) => void;
  deleteRecord: (id: string) => void;
  refresh: () => void;
}

export function useEntity<T extends Record<string, unknown>>(entityName: string): UseEntityResult<T>
```

**Lifecycle**

1. On mount, call `getEntitySocket()` to obtain the shared singleton connection
2. Register listeners for all six server → client events (`entity:list:result`, `entity:created`, `entity:updated`, `entity:deleted`, `entity:error`, `entity:external-change`), each filtering by `entityName`
3. Emit `entity:list` to request the initial dataset
4. On `entity:list:result` — set `records`, set `loading` to false
5. On `entity:created` / `entity:updated` / `entity:external-change` — call `refresh()` (re-emit `entity:list`)
6. On `entity:deleted` — optimistically remove the record from local state by `id`
7. On `entity:error` — set `entityError` with a descriptive message
8. On unmount, remove all six listeners via `socket.off()` using the same function references

**Usage**

```typescript
const { records, loading, saveRecord, deleteRecord } = useEntity<Company>('companies');
```

---

## Anti-Patterns (Critical — From Real Production Experience)

These are patterns that cause silent bugs or hard-to-diagnose failures. Avoid all of them.

**Never create socket connections inside a hook.**
```typescript
// WRONG — creates a new connection on every component mount
const socket = io();

// CORRECT — always use the singleton
const socket = getEntitySocket();
```

**Always cleanup listeners in useEffect return using the same function reference.**
```typescript
// WRONG — creates a new function on each render, off() won't match
socket.on('entity:list:result', (data) => { ... });
return () => socket.off('entity:list:result', (data) => { ... }); // never matches

// CORRECT — named reference that matches
const onListResult = (data) => { ... };
socket.on('entity:list:result', onListResult);
return () => socket.off('entity:list:result', onListResult);
```

**Always wrap server socket handlers in try-catch.**
```typescript
// WRONG — unhandled promise rejection crashes the handler silently
socket.on('entity:list', async (payload) => {
  const records = await listRecords(ENTITY); // throws → silent failure
  socket.emit('entity:list:result', { entity: ENTITY, records });
});

// CORRECT — always catch and emit entity:error
socket.on('entity:list', async (payload) => {
  try {
    const records = await listRecords(ENTITY);
    socket.emit('entity:list:result', { entity: ENTITY, records });
  } catch (err) {
    socket.emit('entity:error', { entity: ENTITY, operation: 'list', message: String(err) });
  }
});
```

**Never fire-and-forget — always emit entity:error on failure.**
Silent server failures mean the client waits forever (loading spinner that never resolves). Always close the loop with an error event.

---

## Cascade Nullification on Delete

For file-based apps, **do not cascade delete**. Set foreign key references to null instead. This prevents data loss when a referenced entity is deleted — related records remain but with a null FK, which is recoverable.

```typescript
// server/src/data/cascadeService.ts
import { listRecords, saveRecord } from './fileStore.js';

/**
 * When an entity record is deleted, nullify references to it in other entities.
 * refs: array of [entityName, fieldName] pairs that reference the deleted id.
 *
 * Example: delete a company with id 'abc12'
 *   nullifyRefs('companies', 'abc12', [['sites', 'companyId'], ['users', 'companyId']])
 */
export async function nullifyRefs(
  entityName: string,
  id: string,
  refs: [string, string][]
): Promise<void> {
  for (const [entity, field] of refs) {
    const records = await listRecords(entity);
    for (const record of records) {
      if (record[field] === id) {
        await saveRecord(entity, { ...record, [field]: null });
      }
    }
  }
}
```

**Use in a delete handler:**

```typescript
socket.on('entity:delete', async (payload) => {
  if (payload?.entity !== ENTITY) return;
  try {
    // nullify before deleting so related records aren't orphaned silently
    await nullifyRefs(ENTITY, payload.id, [
      ['sites', 'companyId'],
      ['users', 'companyId'],
    ]);
    await deleteRecord(ENTITY, payload.id);
    io.emit('entity:deleted', { entity: ENTITY, id: payload.id });
  } catch (err) {
    socket.emit('entity:error', { entity: ENTITY, operation: 'delete', message: String(err) });
  }
});
```

---

## When to Use This Recipe

- You have 2+ entities that need CRUD operations
- You want real-time sync across multiple browser tabs
- You are using file-based persistence (`file-crud` recipe already applied)
- You want a single hook that works for every entity rather than per-entity wiring
- Combined with `nav-shell` + `file-crud` = complete multi-entity CRUD app

---

## What to Generate in the Build Prompt

When generating the prompt for this recipe, collect:

1. **Entity names** — which entities need CRUD? (handler file generated per entity)
2. **Entity name strings** — what is the plural string passed to `useEntity`? (e.g. `'companies'`, `'sites'`)
3. **Delete cascades** — does deleting any entity need to nullify FKs in other entities? List the pairs.
4. **Existing infrastructure** — is `file-crud` already applied? Is `entitySocket.ts` present?
