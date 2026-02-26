# Shared Package & Monorepo Tooling Research

**Date**: 2026-02-15
**Context**: AppyStack template currently has a `shared/` package with 4 TypeScript interfaces (`ApiResponse`, `HealthResponse`, `ServerInfo`, `SocketEvents`) and nothing else. This research investigates whether that is sufficient or an anti-pattern, and covers monorepo build tooling choices.

---

## 1. What Do Popular Monorepo Templates Put in Shared Packages?

### create-t3-turbo (14k+ GitHub stars)

The most popular TypeScript monorepo template does NOT have a generic "shared" package. Instead, it splits shared code into domain-specific packages:

```
packages/
  api/        # tRPC v11 router definitions (shared API contract)
  auth/       # Authentication (better-auth)
  db/         # Drizzle + Supabase (shared schema)
  ui/         # shadcn-ui components

tooling/
  eslint/     # Shared lint presets
  prettier/   # Formatting config
  tailwind/   # Theme config
  typescript/ # Shared tsconfig
```

Key insight: There is no `packages/shared/` or `packages/common/`. The "shared contract" is the tRPC router itself, which provides end-to-end type safety between client and server without a separate types package.

Source: [create-t3-turbo on GitHub](https://github.com/t3-oss/create-t3-turbo)

### bulletproof-react (50k+ GitHub stars)

bulletproof-react is NOT a monorepo. It is a single-app architecture reference with a feature-based folder structure:

```
src/
  app/          # Routes, providers, router
  components/   # Shared UI components
  hooks/        # Shared hooks
  lib/          # Reusable libraries/wrappers
  types/        # Global types
  utils/        # Utility functions
```

There is no separate "shared" package because there is no server in scope. This project is client-only architecture guidance.

Source: [bulletproof-react project structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)

### Basedash (production monorepo writeup)

Basedash's monorepo includes a dedicated `@basedash/constants` package for shared event names and constants, imported across client and server. They use yarn workspaces with package references like:

```json
{
  "dependencies": {
    "@basedash/constants": "*"
  }
}
```

Source: [Basedash TypeScript monorepo setup](https://www.basedash.com/blog/our-typescript-monorepo-setup)

### Common Pattern Across Templates (2025-2026)

The most common shared package structures fall into two categories:

**Category A: Thin types-only (like AppyStack currently)**
- Just TypeScript interfaces, no runtime code
- Works, but misses opportunities for runtime validation

**Category B: Schemas + types + constants (recommended by most guides)**
- Zod schemas as source of truth
- Inferred TypeScript types via `z.infer`
- Shared constants (event names, route paths, status codes)
- Shared error types

### Recommendation for AppyStack

Your current 4-interface approach is NOT an anti-pattern for a starter template, but it IS a missed opportunity. The template already uses Zod on the server (`server/src/config/env.ts`), so the tooling is already in the project. The upgrade path is clear: move from plain interfaces to Zod schemas in shared, keeping the interfaces as inferred types.

---

## 2. Zod Schemas in Shared Packages

### The Pattern

Instead of defining TypeScript interfaces in shared and then separately writing validation logic in the server, define Zod schemas once and derive types from them.

**Current AppyStack approach (interfaces only):**
```typescript
// shared/src/types.ts
export interface ApiResponse<T = unknown> {
  status: 'ok' | 'error';
  data?: T;
  error?: string;
  timestamp: string;
}
```

**Recommended approach (Zod schemas):**
```typescript
// shared/src/schemas/api.ts
import { z } from 'zod';

export const apiResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  data: z.unknown().optional(),
  error: z.string().optional(),
  timestamp: z.string(),
});

export type ApiResponse = z.infer<typeof apiResponseSchema>;

// Generic version for typed data
export function createApiResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    status: z.enum(['ok', 'error']),
    data: dataSchema.optional(),
    error: z.string().optional(),
    timestamp: z.string(),
  });
}
```

### Server Usage (Request Validation)

```typescript
// server/src/routes/posts.ts
import { createPostSchema } from '@myapp/shared';

app.post('/posts', async (req, res) => {
  const result = createPostSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      status: 'error',
      error: result.error.flatten(),
      timestamp: new Date().toISOString(),
    });
  }
  const { title, content } = result.data;
  // ... proceed with validated, typed data
});
```

Source: [Shared Zod Schemas - ruthvikdev.com](https://www.ruthvikdev.com/blog/3-shared-zod-schemas)

### Client Usage (Response Validation)

```typescript
// client/src/lib/api.ts
import { apiResponseSchema, type ApiResponse } from '@myapp/shared';

export async function fetchHealth(): Promise<ApiResponse> {
  const response = await fetch('/health');
  const json = await response.json();
  return apiResponseSchema.parse(json); // Runtime validation of server response
}
```

Source: [Sharing Zod in a monorepo - Leapcell](https://leapcell.io/blog/sharing-types-and-validations-with-zod-across-a-monorepo)

### Full Example: Shared Package Structure with Zod

```
shared/
  package.json          # depends on "zod"
  tsconfig.json
  src/
    index.ts            # barrel export
    schemas/
      api.ts            # ApiResponse, HealthResponse schemas
      socket-events.ts  # Socket event payload schemas
    types.ts            # re-exported inferred types for convenience
    constants.ts        # event names, route paths
```

### Should AppyStack Add Zod to Shared?

**Yes, but as an incremental upgrade, not a rewrite.** The template already depends on Zod in the server package. Moving Zod to shared means:

1. The server's `env.ts` pattern (Zod schema -> validated config) extends to API contracts
2. Client gets runtime validation of server responses for free
3. The types still exist (via `z.infer`) so import patterns do not change
4. Adding Zod to shared adds ~0 bundle weight (it is already in the server, and Vite tree-shakes)

**For a starter template specifically**: Keep the current plain interfaces. They are simpler to understand for someone cloning the template. Add a `TODO: Consider upgrading to Zod schemas for runtime validation` comment. The upgrade path is documented here.

---

## 3. What Shared Utilities Are Common?

### Analysis: What Belongs in Shared vs App-Specific

| Utility | Belongs in Shared? | Rationale |
|---------|-------------------|-----------|
| **Socket event type definitions** | Yes | Must be identical on client and server |
| **API response/request schemas** | Yes | Contract between client and server |
| **Route path constants** | Yes | Prevents `/api/info` vs `/api/Info` drift |
| **Event name constants** | Yes | Prevents `client:ping` vs `client_ping` drift |
| **HTTP status code constants** | Maybe | Most frameworks handle this already |
| **Error types/factories** | Yes | Consistent error shape across stack |
| **Date formatting** | No | Client and server have different formatting needs |
| **ID generation (nanoid/uuid)** | No | Usually only needed on server |
| **Generic utility functions** | No | Risk of becoming a junk drawer |
| **Validation helpers** | Yes (if Zod) | Schemas ARE the validation helpers |

### Socket.IO Type Pattern (Directly Applicable to AppyStack)

Socket.IO has first-class TypeScript support for shared event types. The current `SocketEvents` interface in AppyStack is a simplified version. The official pattern uses four separate interfaces:

```typescript
// shared/src/socket-events.ts

export interface ServerToClientEvents {
  'server:message': (data: { message: string; timestamp: string }) => void;
  'server:status': (data: { connectedClients: number }) => void;
}

export interface ClientToServerEvents {
  'client:ping': () => void;
  'client:message': (data: { text: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  connectedAt: string;
}
```

Server usage:
```typescript
import type { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData }
  from '@myapp/shared';

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer);
```

Client usage:
```typescript
import type { ServerToClientEvents, ClientToServerEvents } from '@myapp/shared';
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
```

Source: [Socket.IO TypeScript documentation](https://socket.io/docs/v4/typescript/)

### Route Path Constants

A simple but effective shared pattern:

```typescript
// shared/src/constants.ts
export const ROUTES = {
  HEALTH: '/health',
  API_INFO: '/api/info',
} as const;

export const SOCKET_EVENTS = {
  CLIENT_PING: 'client:ping',
  SERVER_MESSAGE: 'server:message',
} as const;
```

### Recommendation for AppyStack Template

**Add to the template:**
1. Split `SocketEvents` into `ServerToClientEvents` and `ClientToServerEvents` (follows Socket.IO's official TypeScript pattern)
2. Add a `constants.ts` with route paths and event names

**Do NOT add to the template:**
- Date formatting utilities
- ID generation
- Generic utility functions
- Error factories (add when the app actually needs them)

The template should demonstrate the pattern without being a kitchen sink.

---

## 4. Turborepo vs npm Scripts

### Current AppyStack Setup

The template uses npm workspaces with plain npm scripts and `concurrently`:

```json
{
  "scripts": {
    "dev": "concurrently -n server,client -c blue,green \"npm run dev -w server\" \"npm run dev -w client\"",
    "build": "npm run build -w shared && npm run build -w server && npm run build -w client",
    "test": "npm run test -w server -w client",
    "typecheck": "npm run typecheck -w shared -w server -w client"
  }
}
```

### What Turborepo Would Add

Turborepo wraps around your existing `package.json` scripts and adds:
1. **Task caching**: If source files have not changed, skip the task and replay cached output
2. **Task parallelization**: Automatically runs independent tasks in parallel (respecting dependency graph)
3. **Remote caching**: Share build caches across CI and team members (Vercel-hosted)

Configuration is one file:
```json
// turbo.json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["build"] },
    "typecheck": {},
    "lint": {}
  }
}
```

### Build Time Analysis for a 3-Workspace Monorepo

For a small monorepo like AppyStack (3 packages, ~40 files total):

| Metric | npm scripts | Turborepo | Difference |
|--------|------------|-----------|------------|
| Cold build | ~5-8s | ~5-8s | None (same tasks) |
| Warm build (no changes) | ~5-8s (reruns everything) | ~0.2s (cache hit) | Turbo wins |
| Partial change (1 file) | ~5-8s (reruns everything) | ~1-3s (only affected) | Turbo wins |
| CI with remote cache | N/A | ~0.5s (if cached) | Turbo wins |
| Setup complexity | Zero | ~15 min + turbo.json | npm scripts simpler |
| Dependency | None | `turbo` devDependency | Extra dependency |

The honest answer: **for a 3-package monorepo with fast TypeScript compilation, the time savings on local dev are minimal.** The big wins come from CI caching on larger projects.

Source: [Tolgee - Is Turborepo overhyped?](https://tolgee.io/blog/turborepo-overhyped), [Aviator monorepo tools comparison](https://www.aviator.co/blog/monorepo-tools/)

### What Popular Templates Use

| Template | Build Tool | Why |
|----------|-----------|-----|
| create-t3-turbo | Turborepo | Vercel-sponsored, many packages |
| Most Nx examples | Nx | Task graph, affected analysis |
| Robin Wieruch guides | npm/pnpm workspaces | Simplicity for learning |
| Small production apps | npm workspaces alone | No overhead for 2-4 packages |

### Is Turborepo Worth It for AppyStack?

**Not yet.** Here is the decision framework:

- **0-4 packages**: npm workspaces + `concurrently` is fine. The build graph is trivial.
- **5-10 packages**: Turborepo starts paying off. Cache hits on CI matter.
- **10+ packages**: Turborepo or Nx is almost required.

AppyStack's build command already expresses the correct dependency order (`shared && server && client`). Turborepo would just discover this automatically from `package.json` dependencies.

**Add Turborepo when**: You add more shared packages (e.g., `@appystack/ui`, `@appystack/db`) and the build graph becomes non-trivial.

### Recommendation for AppyStack Template

**Keep npm workspaces + concurrently.** Add a comment in the root `package.json`:

```json
// NOTE: When this monorepo grows beyond 4 packages, consider adding Turborepo
// for build caching. See docs/plans/shared-package-research.md for analysis.
```

---

## 5. Port Coordination in Monorepos

### Current AppyStack Pattern

Ports are hardcoded in three places:

1. **`.env.example`**: `PORT=5501`, `CLIENT_URL=http://localhost:5500`
2. **`server/src/config/env.ts`**: Zod defaults `PORT: 5501`, `CLIENT_URL: http://localhost:5500`
3. **`client/vite.config.ts`**: `port: 5500`, proxy target `http://localhost:5501`

This means changing ports requires editing 3 files. The `.env` file is the intended single source of truth, but the Vite config cannot read it.

### How Reference Projects Handle This

**Pattern A: Vite `loadEnv` (recommended)**

Vite provides a `loadEnv` helper that can read `.env` files inside `vite.config.ts`:

```typescript
// client/vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env from the monorepo root (one level up)
  const env = loadEnv(mode, '..', '');

  const serverPort = env.PORT || '5501';

  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_CLIENT_PORT || '5500'),
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
        '/health': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
        '/socket.io': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
```

Source: [Vite - Configuring Vite](https://vite.dev/config/), [Vite discussion #2260](https://github.com/vitejs/vite/discussions/2260)

**Pattern B: Shared constants file in shared package**

```typescript
// shared/src/constants.ts
export const PORTS = {
  CLIENT: 5500,
  SERVER: 5501,
} as const;
```

Problem: This does not work for `vite.config.ts` easily (import from workspace package in config files can be tricky) and it hardcodes values that should be environment-configurable.

**Pattern C: Root-level `.env` with `dotenv-mono`**

Tools like `dotenv-mono` or `monoenv` let all packages in a monorepo read from a single root `.env`. However, this adds a dependency for something Vite can already do natively.

Source: [dotenv-mono on npm](https://www.npmjs.com/package/dotenv-mono)

### Recommendation for AppyStack Template

**Use Pattern A (Vite `loadEnv`).** This is the cleanest approach because:

1. The `.env` file at the project root becomes the actual single source of truth
2. No extra dependencies needed (Vite provides `loadEnv` built-in)
3. Server already reads `.env` via `dotenv` + Zod
4. Client's Vite config reads the same `.env` via `loadEnv`

The `.env.example` would contain:
```
NODE_ENV=development
PORT=5501
CLIENT_URL=http://localhost:5500
VITE_CLIENT_PORT=5500
```

The client's `vite.config.ts` uses `loadEnv` to read `PORT` (for proxy target) and `VITE_CLIENT_PORT` (for its own port). The server's `env.ts` reads `PORT` and `CLIENT_URL` via dotenv + Zod as it does today.

**For the template specifically**: The current hardcoded approach is actually fine for a starter template. It is explicit, easy to understand, and the TODO comments guide developers to update the values. The `loadEnv` pattern is an improvement to document but may be over-engineering for a boilerplate that is meant to be forked and customized.

---

## Summary of Recommendations

| Question | Recommendation | Priority |
|----------|---------------|----------|
| Shared package contents | Current 4 interfaces are fine for a template. Add `constants.ts` and split Socket.IO types to follow official pattern. | Medium |
| Zod schemas in shared | Document as upgrade path. Do not add to template (adds complexity for first-time users). | Low (for template) |
| Shared utilities | Add route path and event name constants only. No date/ID/generic utils. | Medium |
| Turborepo | Stay with npm workspaces. Add Turborepo when monorepo exceeds 4 packages. | Not now |
| Port coordination | Current hardcoded approach is fine for template. Document `loadEnv` pattern as upgrade. | Low |
| Live types (no build step) | Consider custom export conditions pattern for shared package to skip build during dev. | Medium |

### Concrete Changes for the Template

**Do now:**
1. Split `SocketEvents` into `ServerToClientEvents` and `ClientToServerEvents` (matches Socket.IO official pattern)
2. Add `shared/src/constants.ts` with `ROUTES` and `SOCKET_EVENTS` objects
3. Update `shared/src/index.ts` barrel to export constants

**Document as upgrade path (in architecture.md or CLAUDE.md):**
1. Zod schemas in shared for runtime validation on both sides
2. Vite `loadEnv` for single-source-of-truth port config
3. Custom export conditions for live types without build step
4. Turborepo adoption criteria (5+ packages)

---

## Sources

- [create-t3-turbo on GitHub](https://github.com/t3-oss/create-t3-turbo)
- [bulletproof-react project structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
- [Type-Safe Frontend + Backend Contracts Using Shared Zod Schemas](https://www.ruthvikdev.com/blog/3-shared-zod-schemas)
- [Sharing Types and Validations with Zod Across a Monorepo](https://leapcell.io/blog/sharing-types-and-validations-with-zod-across-a-monorepo)
- [Socket.IO TypeScript Documentation](https://socket.io/docs/v4/typescript/)
- [Live Types in a TypeScript Monorepo - Colin Hacks](https://colinhacks.com/essays/live-types-typescript-monorepo)
- [Basedash TypeScript Monorepo Setup](https://www.basedash.com/blog/our-typescript-monorepo-setup)
- [Tolgee - Is Turborepo Overhyped?](https://tolgee.io/blog/turborepo-overhyped)
- [Monorepo Tools Comparison - Aviator](https://www.aviator.co/blog/monorepo-tools/)
- [Monorepo Tools Comparison - Graphite](https://www.graphite.com/guides/monorepo-tools-a-comprehensive-comparison)
- [Vite Configuration - loadEnv](https://vite.dev/config/)
- [Vite env in config discussion](https://github.com/vitejs/vite/discussions/2260)
- [Turborepo Documentation](https://turborepo.dev/docs)
- [Structuring a Turborepo Repository](https://turbo.build/repo/docs/crafting-your-repository/structuring-a-repository)
- [dotenv-mono on npm](https://www.npmjs.com/package/dotenv-mono)
- [Monorepos in JavaScript & TypeScript - Robin Wieruch](https://www.robinwieruch.de/javascript-monorepos/)
- [Type-Safe Full-Stack with Zod - Michael Guay](https://michaelguay.dev/type-safe-full-stack-development-shared-types-between-tanstack-router-and-nestjs-with-zod/)
