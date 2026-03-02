# CLAUDE.md

AI agent context for the AppyStack template project.

## What Is This?

A RVETS stack boilerplate (React, Vite, Express, TypeScript, Socket.io) structured as an npm workspaces monorepo with three packages: client, server, and shared.

## Architecture

```
client (React 19 + Vite 7 + TailwindCSS v4)  →  port 5500
  ↕ proxy (/api, /health, /socket.io)
server (Express 5 + Socket.io + Pino + Zod)   →  port 5501
  ↕ imports
shared (TypeScript interfaces only)
```

## Commands

```bash
npm run dev           # Start both client + server (concurrently)
npm run build         # Build shared → server → client
npm test              # Run server + client tests
npm run lint          # ESLint 9 flat config
npm run format:check  # Prettier check
npm run typecheck     # TypeScript across all workspaces
```

## Key Files

- `server/src/config/env.ts` — Zod-validated environment config
- `server/src/index.ts` — Express app + Socket.io + graceful shutdown
- `client/src/pages/LandingPage.tsx` — Clean starting page with ASCII banner (replace TODO content with your app)
- `client/src/demo/DemoPage.tsx` — Template feature showcase (delete when building your app)
- `client/src/demo/StatusGrid.tsx` — Demo: server health status cards (in demo/, delete when done)
- `client/src/demo/TechStackDisplay.tsx` — Demo: tech stack listing (in demo/, delete when done)
- `client/src/demo/SocketDemo.tsx` — Demo: Socket.io ping/pong (in demo/, delete when done)
- `client/src/hooks/useServerStatus.ts` — Fetches /health and /api/info
- `client/src/hooks/useSocket.ts` — Socket.io connection hook
- `shared/src/types.ts` — All shared TypeScript interfaces
- `client/vite.config.ts` — Dev proxy config (routes /api, /health, /socket.io to server)

## Patterns

- **Shared types**: Define in `shared/src/types.ts`, import via `@appystack-template/shared`
- **API routes**: Add to `server/src/routes/`, mount in `server/src/index.ts`
- **Socket events**: Add to `ServerToClientEvents` / `ClientToServerEvents` in shared, handle in `server/src/index.ts`
- **Components**: Place in `client/src/components/`, pages in `client/src/pages/`
- **Demo components**: Live in `client/src/demo/` — delete the entire folder when starting your app
  - The `demo/` folder (StatusGrid, TechStackDisplay, SocketDemo, ContactForm) is intentionally untested
  - It is scaffolding designed to be deleted when building a real app
  - Tests for demo/ components would be maintenance debt on throwaway code
  - When you delete `demo/`, delete any test files associated with it
- **Styling**: TailwindCSS v4 with CSS variables in `client/src/styles/index.css`
- **Environment**: Extend Zod schema in `server/src/config/env.ts`

## Customization TODO Markers

Search for `TODO` to find all customization points:

- Project name and package scopes
- Port numbers (5500/5501)
- ASCII banner branding
- Shared type interfaces
- ESLint config (now imports from `@appydave/appystack-config/eslint/react` — already done)

## Testing

- **Server**: Vitest + Supertest (`server/src/test/`)
- **Client**: Vitest + Testing Library + jsdom (`client/src/test/`)
- Mocks: Client tests mock `useServerStatus` and `useSocket` hooks

## Config Inheritance

ESLint config imports from `@appydave/appystack-config/eslint/react` (3-line config — migration complete as of Wave 2).

TypeScript configs extend from `@appydave/appystack-config/typescript/{base,node,react}`.

## For Consumer Apps (After Customizing This Template)

This CLAUDE.md describes the template as-shipped. Once you've built on top of it, update this section so AI coding agents understand your specific setup.

### Database (update if applicable)

- ORM/driver: \***\*\_\_\_\*\***
- Schema location: \***\*\_\_\_\*\***
- Migration command: \***\*\_\_\_\*\***
- Test strategy: \***\*\_\_\_\*\***

### Authentication (update if applicable)

- Approach: \***\*\_\_\_\*\***
- Token storage: \***\*\_\_\_\*\***
- Protected route middleware: \***\*\_\_\_\*\***
- Socket.io auth: \***\*\_\_\_\*\***

### State Management (update if applicable)

- Library: \***\*\_\_\_\*\***
- Store location: \***\*\_\_\_\*\***
- Key patterns: \***\*\_\_\_\*\***

### Custom Middleware (update if applicable)

List any middleware added beyond the defaults (helmet, compression, cors, requestLogger, rateLimiter, errorHandler):

- ***

### Additional Environment Variables

Document any env vars added beyond NODE_ENV, PORT, CLIENT_URL, VITE_API_URL, VITE_APP_NAME:

- ***
