# Database Integration

> This is a structural integration guide — not an ORM tutorial. It tells you WHERE and HOW to wire any database into AppyStack regardless of which tool you choose: Prisma, Drizzle, Kysely, `postgres`, `better-sqlite3`, or anything else.

AppyStack deliberately excludes a database layer. The correct place to add one is documented here. Follow these sections in order when integrating a database for the first time.

---

## 1. Where the Database Layer Lives

All database code belongs under `server/src/db/`. Do not scatter database calls across route handlers or service files — give the database its own directory from the start.

```
server/src/
  db/
    index.ts          ← connection setup and export (the "db" singleton)
    messages.ts       ← query functions for the messages resource
    users.ts          ← query functions for the users resource
  config/
    env.ts            ← connection string validated here (see Section 2)
  routes/
    messages.ts       ← imports from ../db/messages.js
```

If you are using an ORM that generates a single client (Prisma, Drizzle), `db/index.ts` is where that client is created and exported:

```typescript
// server/src/db/index.ts (Prisma example)
import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient();
```

```typescript
// server/src/db/index.ts (Drizzle + postgres example)
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env.js';

const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool);
export { pool }; // exported so the shutdown handler can call pool.end()
```

```typescript
// server/src/db/index.ts (raw node-postgres example)
import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
```

Query functions live in resource-specific files and import `db` from `index.ts`:

```typescript
// server/src/db/messages.ts
import { db } from './index.js';
import type { Message } from '@appystack-template/shared';

export async function getAllMessages(): Promise<Message[]> {
  // Replace the body with your ORM/driver query
  const result = await db.query('SELECT * FROM messages ORDER BY created_at ASC');
  return result.rows as Message[];
}

export async function insertMessage(
  author: string,
  text: string
): Promise<Message> {
  const result = await db.query(
    'INSERT INTO messages (id, author, text, created_at) VALUES (gen_random_uuid(), $1, $2, NOW()) RETURNING *',
    [author, text]
  );
  return result.rows[0] as Message;
}
```

Route handlers import from the `db/` layer, not from `db/index.ts` directly:

```typescript
// server/src/routes/messages.ts
import { getAllMessages, insertMessage } from '../db/messages.js';

router.get('/api/messages', async (_req, res, next) => {
  try {
    const messages = await getAllMessages();
    apiSuccess(res, messages);
  } catch (err) {
    next(err);
  }
});
```

---

## 2. Adding the Connection String to the Zod Schema

Never access `process.env.DATABASE_URL` directly in route or service files. All environment variables must go through the Zod schema in `server/src/config/env.ts` so the server validates them at startup and fails loudly if they are missing or malformed.

Add your connection string field to the schema:

```typescript
// server/src/config/env.ts
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5501),
  CLIENT_URL: z.string().default('http://localhost:5500'),

  // Add your database URL here
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection URL'),
});
```

If the variable should be optional in development (e.g., you want the server to start without a database for front-end-only work), use `.optional()` or provide a default:

```typescript
DATABASE_URL: z.string().url().optional(),
```

Add the variable to `.env` and `.env.example`:

```bash
# .env (not committed — add to .gitignore)
DATABASE_URL=postgresql://user:password@localhost:5432/myapp

# .env.example (committed — documents required variables)
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
```

The `env` object exported from `env.ts` is the single source of truth for all runtime config. Import it in `server/src/db/index.ts` to create the connection:

```typescript
import { env } from '../config/env.js';

const pool = new Pool({ connectionString: env.DATABASE_URL });
```

---

## 3. Wiring Database Disconnect into Graceful Shutdown

`server/src/index.ts` already handles `SIGTERM` and `SIGINT` signals. Extend the `shutdown` function to close the database connection before exiting. This prevents connection pool timeouts and ensures in-flight queries complete.

Locate the existing shutdown block in `index.ts`:

```typescript
// server/src/index.ts (existing pattern)
const shutdown = () => {
  logger.info('Shutting down gracefully...');
  io.close();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

Import your connection pool or client from `db/index.ts` and close it inside the `httpServer.close` callback:

```typescript
// server/src/index.ts (updated for postgres pool)
import { pool } from './db/index.js';

const shutdown = () => {
  logger.info('Shutting down gracefully...');
  io.close();
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    try {
      await pool.end();
      logger.info('Database pool closed');
    } catch (err) {
      logger.error({ err }, 'Error closing database pool');
    }
    process.exit(0);
  });
};
```

For Prisma, replace `pool.end()` with `db.$disconnect()`. For Drizzle with a pool, call `pool.end()` on the underlying driver pool.

The ordering matters: close the HTTP server first (stops new requests), then close the database (allows queued operations to finish), then exit.

---

## 4. Handling the Database Connection in Tests

Tests have two options: mock the database layer entirely, or use a dedicated test database. Choose based on what you are testing.

### Option A — Mock the database layer (unit tests)

For route and service tests that verify HTTP behavior and business logic, mock the `db/` query functions directly. This is fast, requires no external process, and keeps tests isolated.

```typescript
// server/src/routes/messages.test.ts
import { vi } from 'vitest';

// Mock before importing the router
vi.mock('../db/messages.js', () => ({
  getAllMessages: vi.fn(),
  insertMessage: vi.fn(),
}));

import { getAllMessages, insertMessage } from '../db/messages.js';
import { createMessagesRouter } from './messages.js';
```

Control return values per test:

```typescript
it('GET /api/messages returns the message list', async () => {
  vi.mocked(getAllMessages).mockResolvedValue([
    { id: '1', author: 'Alice', text: 'Hello', createdAt: '2026-01-01T00:00:00.000Z' },
  ]);

  const res = await request(app).get('/api/messages');
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(1);
});

it('returns 500 when the database throws', async () => {
  vi.mocked(getAllMessages).mockRejectedValue(new Error('connection refused'));

  const res = await request(app).get('/api/messages');
  expect(res.status).toBe(500);
});
```

The `vi.mock` call is hoisted to the top of the file by Vitest, so it runs before any imports. See [testing-guide.md](./testing-guide.md) for the full module mock pattern.

### Option B — Test database (integration tests)

For tests that verify queries produce correct results (schema, indexes, constraints), run a real database in test mode.

Common approaches:

- **SQLite in-memory** (for local dev speed): swap the connection string in tests to `':memory:'` or a temp file.
- **Docker test database**: spin up a Postgres container in `beforeAll`, run migrations, and tear it down in `afterAll`.
- **Isolated test schema**: use a separate database or Postgres schema per test run, reset between suites.

Regardless of approach, keep the test database config in `env.ts` by setting `DATABASE_URL` in the test environment:

```bash
# .env.test (or set via vitest config)
DATABASE_URL=postgresql://user:password@localhost:5432/myapp_test
```

The `env.isTest` flag is available in `env.ts` if you need to branch logic:

```typescript
// server/src/db/index.ts
import { env } from '../config/env.js';

const connectionString = env.isTest
  ? env.DATABASE_URL ?? 'postgresql://localhost/myapp_test'
  : env.DATABASE_URL;

export const pool = new Pool({ connectionString });
```

In a test file, prevent the server from binding its port (the template already does this with `if (!env.isTest) httpServer.listen(...)`) and reset data between tests:

```typescript
// server/src/db/messages.test.ts
import { beforeEach, afterAll } from 'vitest';
import { pool } from '../db/index.js';

beforeEach(async () => {
  await pool.query('TRUNCATE messages RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});
```

---

## 5. Structuring Queries

Keep query functions simple: one file per resource, one function per query. Do not build abstractions until you have a real reason for them.

### What to do

```typescript
// server/src/db/messages.ts — clear, readable, easy to type-check
import { pool } from './index.js';
import type { Message } from '@appystack-template/shared';

export async function getAllMessages(): Promise<Message[]> {
  const result = await pool.query(
    'SELECT id, author, text, created_at AS "createdAt" FROM messages ORDER BY created_at ASC'
  );
  return result.rows as Message[];
}

export async function getMessageById(id: string): Promise<Message | null> {
  const result = await pool.query(
    'SELECT id, author, text, created_at AS "createdAt" FROM messages WHERE id = $1',
    [id]
  );
  return (result.rows[0] as Message) ?? null;
}

export async function insertMessage(author: string, text: string): Promise<Message> {
  const result = await pool.query(
    `INSERT INTO messages (id, author, text, created_at)
     VALUES (gen_random_uuid(), $1, $2, NOW())
     RETURNING id, author, text, created_at AS "createdAt"`,
    [author, text]
  );
  return result.rows[0] as Message;
}

export async function deleteMessage(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM messages WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
```

### What to avoid

Do not build a generic repository class, query builder wrapper, or base CRUD abstraction at the start. You almost certainly will not need it, and it makes queries harder to read and test.

```typescript
// Avoid — magic abstractions that obscure what the query actually does
class Repository<T> {
  async findAll(): Promise<T[]> { /* ... */ }
  async findById(id: string): Promise<T | null> { /* ... */ }
}
```

When a query grows complex — joins, pagination, search — write it in full SQL (or ORM query builder) inside a clearly named function. The function name describes the intent; the body is the implementation. Readers should be able to understand what a query does without tracing through multiple layers of abstraction.

### Transactions

For operations that must succeed or fail atomically, use the driver's transaction API directly:

```typescript
// server/src/db/orders.ts (postgres transaction example)
export async function createOrderWithItems(
  userId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<Order> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query(
      'INSERT INTO orders (id, user_id) VALUES (gen_random_uuid(), $1) RETURNING *',
      [userId]
    );
    const order = orderRes.rows[0] as Order;
    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)',
        [order.id, item.productId, item.quantity]
      );
    }
    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

---

## 6. ORM and Driver Recommendations

**Prisma** and **Drizzle** are both well-suited to this stack. Prisma provides a schema-first workflow with a migration CLI and a generated client that gives you autocomplete on every query. Drizzle keeps you closer to SQL, uses TypeScript objects as the schema, and has no code generation step — the schema and the query builder are one thing. Either integrates cleanly into `server/src/db/index.ts` as shown above.

For raw SQL, `postgres` (the `postgres` npm package, not `pg`) and `better-sqlite3` work directly without an ORM layer. The `postgres` package is well-typed and works with template literals. `better-sqlite3` runs synchronously and is ideal for low-concurrency tools or local-only apps where async overhead is not justified.

---

## Cross-references

- `template/server/src/config/env.ts` — Zod env schema where `DATABASE_URL` belongs
- `template/server/src/index.ts` — Graceful shutdown handler where `pool.end()` is called
- [testing-guide.md](./testing-guide.md) — Module mocking patterns, `vi.mock`, `vi.resetModules`
- [api-design.md](./api-design.md) — Route structure and `AppError` for surfacing database errors to clients
- [first-feature.md](./first-feature.md) — Full end-to-end walkthrough showing where database calls slot into a real route
