# AppyStack Documentation

Complete reference for building on the RVETS stack (React + Vite + Express + TypeScript + Socket.io).

## Guides

| Guide | What's in it |
|-------|-------------|
| [Getting Started](getting-started.md) | First steps after scaffolding |
| [Testing Guide](testing-guide.md) | Vitest patterns, MSW, hook testing, socket mocks |
| [Troubleshooting](troubleshooting.md) | Common problems and fixes |

## Reference

| Reference | What's in it |
|-----------|-------------|
| [Architecture](architecture.md) | Full stack decisions, pitfalls, npm publishing |
| [API Design](api-design.md) | Route conventions, error handling, Zod validation |
| [Socket.io](socket-io.md) | Event patterns, auth, rooms, typed events |
| [Environment](environment.md) | Env var setup, Zod schema patterns |
| [Authentication](authentication.md) | Auth patterns (JWT, sessions) |
| [Extending Configs](extending-configs.md) | How to extend ESLint, TypeScript, Prettier configs |
| [Deployment](deployment.md) | Production build, serving, Docker |
| [Database](database.md) | Persistence options (file-based, Prisma, Drizzle) |

## Recipes

Recipes are composable patterns that sit on top of the RVETS template. Run `/recipe` in Claude Code to use them.

| Recipe | What it builds |
|--------|---------------|
| `nav-shell` | Left-sidebar layout with header, collapsible sidebar, main content area |
| `file-crud` | JSON file-based persistence, chokidar watcher, Socket.io sync, useEntity hook |
| `entity-socket-crud` | Generic Socket.io CRUD contract for any entity (useEntity hook, handler template) |
| `local-service` | Unified startup via Procfile + Overmind, optional Platypus .app launcher |

Recipes are composable:
- `nav-shell` + `file-crud` = complete single-entity CRUD app
- `nav-shell` + `entity-socket-crud` = multi-entity CRUD app with real-time sync
- Any recipe + `local-service` = persistent local service with Spotlight launch

## Plans

Historical planning documents for AppyStack development waves are in `plans/`.
