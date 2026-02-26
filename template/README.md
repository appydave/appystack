# AppyStack Template

Production-ready RVETS stack boilerplate (React, Vite, Express, TypeScript, Socket.io).

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
# Open http://localhost:5500
```

## Features

- **React 19** with Vite 7 and TailwindCSS v4
- **Express 5** with Socket.io, Pino logging, Zod validation
- **TypeScript** across all workspaces with shared types
- **npm workspaces** monorepo (client / server / shared)
- **ESLint 9** flat config + Prettier
- **Vitest** for both client and server testing
- **Security** via Helmet + CORS + request logging with UUID tracing

## Scripts

| Script                  | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `npm run dev`           | Start both client and server in development mode |
| `npm run build`         | Build all workspaces (shared → server → client)  |
| `npm test`              | Run all tests                                    |
| `npm run test:coverage` | Run tests with coverage                          |
| `npm run lint`          | Lint all files                                   |
| `npm run lint:fix`      | Lint and auto-fix                                |
| `npm run format`        | Format all files with Prettier                   |
| `npm run format:check`  | Check formatting                                 |
| `npm run typecheck`     | Type-check all workspaces                        |

## Project Structure

```
template/
├── client/          # React + Vite (port 5500)
│   ├── src/
│   │   ├── components/   # StatusGrid, TechStackDisplay
│   │   ├── hooks/        # useSocket, useServerStatus
│   │   ├── pages/        # LandingPage
│   │   ├── styles/       # TailwindCSS v4
│   │   └── test/
│   └── vite.config.ts    # Dev server + proxy config
├── server/          # Express + Socket.io (port 5501)
│   ├── src/
│   │   ├── config/       # env (Zod), logger (Pino)
│   │   ├── middleware/   # requestLogger (pino-http)
│   │   ├── routes/       # health, info
│   │   └── test/
│   └── nodemon.json
├── shared/          # Shared TypeScript types
│   └── src/
│       ├── types.ts      # ApiResponse, HealthResponse, ServerInfo, SocketEvents
│       └── index.ts
├── eslint.config.js
├── .prettierrc
└── package.json     # Workspace root
```

## Customization

Search for `TODO` comments throughout the codebase to find all project-specific values:

- **Project name**: `package.json` files (`@appystack-template/*`)
- **Ports**: Client `5500` in `vite.config.ts`, Server `5501` in `.env` and `server/src/config/env.ts`
- **Branding**: ASCII banner in `client/src/pages/LandingPage.tsx`
- **Types**: Shared interfaces in `shared/src/types.ts`

## Port Configuration

| Service          | Port | Config Location                    |
| ---------------- | ---- | ---------------------------------- |
| Client (Vite)    | 5500 | `client/vite.config.ts`            |
| Server (Express) | 5501 | `.env`, `server/src/config/env.ts` |

The client proxies `/api`, `/health`, and `/socket.io` requests to the server during development.

## API Endpoints

| Endpoint        | Description                                                   |
| --------------- | ------------------------------------------------------------- |
| `GET /health`   | Returns `{status: "ok", timestamp}`                           |
| `GET /api/info` | Returns server info (Node version, environment, port, uptime) |

## Socket.io Events

| Event            | Direction       | Description                         |
| ---------------- | --------------- | ----------------------------------- |
| `client:ping`    | Client → Server | Ping the server                     |
| `server:message` | Server → Client | Response with message and timestamp |
