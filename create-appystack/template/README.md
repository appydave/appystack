# [App Name]

> One line describing what this app is. Replace this.

Built on the [AppyStack](https://github.com/appydave/appystack) RVETS template — React, Vite, Express, TypeScript, Socket.io.

---

## Stack

| Layer      | Technology                   | Role in this project                                                                 |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| Client     | React 19 + Vite 7            | UI — served from port 5500 in dev, proxies `/api`, `/health`, `/socket.io` to server |
| Server     | Express 5 + Socket.io        | REST API + real-time events on port 5501                                             |
| Shared     | TypeScript only              | Interfaces that both client and server import — no runtime code                      |
| Styling    | TailwindCSS v4               | Utility classes, CSS variables in `client/src/styles/index.css`                      |
| Validation | Zod                          | Server env vars + request body schemas                                               |
| Logging    | Pino + pino-http             | Structured JSON logs, request tracing with UUID                                      |
| Quality    | Vitest + ESLint 9 + Prettier | Tests, linting, formatting across all workspaces                                     |

---

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
# Client: http://localhost:5500
# Server: http://localhost:5501
```

Both processes start concurrently. The client dev server proxies all `/api`, `/health`, and `/socket.io` requests to the Express server — no CORS configuration needed in development.

---

## What's In Here

### `client/` — React app (port 5500)

**Demo components** (`client/src/demo/`) — delete this entire folder when starting your app:

| Component          | What it does                                                     |
| ------------------ | ---------------------------------------------------------------- |
| `StatusGrid`       | Displays server health + info fetched on load                    |
| `TechStackDisplay` | Lists the tech stack — replace or delete for your app            |
| `SocketDemo`       | Live ping/pong demo via Socket.io — shows real-time wiring works |
| `ContactForm`      | Example form with React Hook Form + Zod validation               |

**Components** (`client/src/components/`):

| Component       | What it does               |
| --------------- | -------------------------- |
| `ErrorFallback` | Error boundary fallback UI |

**Hooks** (`client/src/hooks/`):

| Hook              | What it does                                                     |
| ----------------- | ---------------------------------------------------------------- |
| `useServerStatus` | Fetches `/health` and `/api/info` on mount, returns status state |
| `useSocket`       | Manages Socket.io connection lifecycle, exposes connection state |

**Pages** (`client/src/pages/`):

- `LandingPage.tsx` — The default landing page with ASCII banner and status grid. Replace the banner and content for your app.

**Vite config** (`client/vite.config.ts`):

Dev proxy routes `/api`, `/health`, and `/socket.io` to `http://localhost:5501`. Update target if you change the server port.

---

### `server/` — Express API (port 5501)

**Routes** (`server/src/routes/`):

| Route           | What it does                                    |
| --------------- | ----------------------------------------------- |
| `GET /health`   | Returns `{ status: "ok", timestamp }`           |
| `GET /api/info` | Returns Node version, environment, port, uptime |

**Middleware** (`server/src/middleware/`):

| Middleware      | What it does                                                |
| --------------- | ----------------------------------------------------------- |
| `requestLogger` | Pino-http request logging with UUID per request             |
| `errorHandler`  | Central error handler — catches thrown errors, returns JSON |
| `rateLimiter`   | Express rate-limit — 100 requests per 15 minutes per IP     |
| `validate`      | Zod request body validation factory                         |

**Config** (`server/src/config/`):

- `env.ts` — Zod-validated environment variables. Add new vars here; they'll be type-safe everywhere.
- `logger.ts` — Pino logger instance. Import this rather than using `console` in server code.

**Socket.io events** (wired in `server/src/index.ts`):

| Event            | Direction       | What it does                        |
| ---------------- | --------------- | ----------------------------------- |
| `client:ping`    | Client → Server | Ping                                |
| `server:message` | Server → Client | Response with message and timestamp |

---

### `shared/` — TypeScript interfaces

`shared/src/types.ts` holds all interfaces used by both client and server:

- `ApiResponse<T>` — wrapper for all API responses
- `HealthResponse` — shape of `/health`
- `ServerInfo` — shape of `/api/info`
- `SocketEvents` — `ServerToClientEvents` + `ClientToServerEvents`

Import in client or server:

```typescript
import type { ApiResponse, SocketEvents } from '@appystack-template/shared';
```

---

## Customisation

Run the interactive setup script first:

```bash
npm run customize
```

That handles renaming package scopes and setting ports. Then work through this checklist:

- [ ] Rename packages in `package.json`, `client/package.json`, `server/package.json`, `shared/package.json` — change `@appystack-template/*` to `@your-app/*`
- [ ] Update ports if 5500/5501 are taken — change `client/vite.config.ts`, `.env`, and `server/src/config/env.ts`
- [ ] Replace the ASCII banner in `client/src/pages/LandingPage.tsx`
- [ ] Define your domain types in `shared/src/types.ts` — replace or extend `ServerInfo` / `SocketEvents`
- [ ] Add your first API route in `server/src/routes/`, mount it in `server/src/index.ts`
- [ ] Add your first Socket.io event to `ClientToServerEvents` / `ServerToClientEvents` in shared, then handle in `server/src/index.ts`
- [ ] Delete or repurpose `TechStackDisplay` and `SocketDemo` once you have real content
- [ ] Add your environment variables to `.env.example` and the Zod schema in `server/src/config/env.ts`

Search for `TODO` across the codebase to find every customisation point:

```bash
grep -r "TODO" --include="*.ts" --include="*.tsx" --include="*.json" .
```

---

## Port Configuration

| Service          | Port | Config location                    |
| ---------------- | ---- | ---------------------------------- |
| Client (Vite)    | 5500 | `client/vite.config.ts`            |
| Server (Express) | 5501 | `.env`, `server/src/config/env.ts` |

The client proxies `/api`, `/health`, and `/socket.io` to the server during development. No CORS config needed in dev.

---

## Scripts

| Script                  | What it does                                     |
| ----------------------- | ------------------------------------------------ |
| `npm run dev`           | Start client + server concurrently               |
| `npm run build`         | Build shared → server → client                   |
| `npm test`              | Run all tests (server + client)                  |
| `npm run test:coverage` | Run tests with coverage report                   |
| `npm run lint`          | ESLint across all workspaces                     |
| `npm run lint:fix`      | ESLint with auto-fix                             |
| `npm run format`        | Prettier — write all files                       |
| `npm run format:check`  | Prettier — check only                            |
| `npm run typecheck`     | TypeScript check across all workspaces           |
| `npm run clean`         | Remove all `node_modules` and `dist` directories |
| `npm run customize`     | Interactive rename + port setup script           |

---

## Adding Things

### New API route

1. Create `server/src/routes/your-route.ts`
2. Mount it in `server/src/index.ts`: `app.use('/api/your-route', yourRouter)`
3. Add the response type to `shared/src/types.ts` if the client needs it

### New Socket.io event

1. Add to `ClientToServerEvents` or `ServerToClientEvents` in `shared/src/types.ts`
2. Handle the event in `server/src/index.ts` inside the `io.on('connection', ...)` block
3. Emit from the client via the `useSocket` hook

### New environment variable

1. Add to `.env` and `.env.example`
2. Add to the Zod schema in `server/src/config/env.ts`
3. Export from the `env` object — it will be type-safe everywhere it's imported

### New shared type

1. Add to `shared/src/types.ts`
2. Re-export from `shared/src/index.ts` if not already exported
3. Import in client or server: `import type { YourType } from '@appystack-template/shared'`

---

## Docs

AppyStack patterns and decisions are documented in the AppyStack repo:

| Guide                                         | What's in it                                           |
| --------------------------------------------- | ------------------------------------------------------ |
| [Testing guide](../docs/testing-guide.md)     | Vitest patterns, MSW setup, hook testing, socket mocks |
| [Socket.io guide](../docs/socket-io.md)       | Event patterns, auth, rooms, typed events              |
| [API design](../docs/api-design.md)           | Route conventions, error handling, validation patterns |
| [Architecture](../docs/architecture.md)       | Full stack decisions, pitfalls, npm publishing         |
| [Environment](../docs/environment.md)         | Env var setup, Zod schema patterns                     |
| [Troubleshooting](../docs/troubleshooting.md) | Common problems and fixes                              |

> These links are relative to the AppyStack repo. If you copied the template without the docs, find them at https://github.com/appydave/appystack/tree/main/docs
