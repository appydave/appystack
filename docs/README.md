# AppyStack Docs

> Reference guides for the AppyStack RVETS template and config package.

## Quick Start

```bash
npx create-appystack@latest my-app
# or with flags:
npx create-appystack@latest my-app --scope @myorg --port 5500 --description "My app"
```

## Guides

| Guide | What it covers |
|---|---|
| [Getting Started](./getting-started.md) | First-time setup, project creation, verification steps |
| [First Feature](./first-feature.md) | End-to-end walkthrough: shared types → server route → socket event → client hook → tests |
| [Testing Guide](./testing-guide.md) | Vitest patterns, mocking, test structure for client and server |
| [Troubleshooting](./troubleshooting.md) | Common errors and how to fix them |

## Reference

| Document | What it covers |
|---|---|
| [Architecture](./architecture.md) | Full stack decisions, patterns, and rationale |
| [Requirements](./requirements.md) | Setup checklist and dependency matrix |
| [Environment](./environment.md) | Environment variables, validation, and env.ts patterns |
| [API Design](./api-design.md) | REST conventions, route structure, request/response patterns |
| [Socket.io](./socket-io.md) | Real-time event patterns, auth, and client/server integration |
| [Authentication](./authentication.md) | JWT auth — routes, middleware, Socket.io handshake, client token storage |
| [Extending Configs](./extending-configs.md) | How to customise ESLint, TypeScript, Vitest, and Prettier configs |
| [Deployment](./deployment.md) | Build, production configuration, and deploy workflows |
| [Database](./database.md) | Where and how to integrate any database: env schema, shutdown hook, query structure, test patterns |

## Recipes (Claude Code Skill)

Recipes scaffold specific app architectures on top of the RVETS template. Available via `/recipe` in any project created with `create-appystack`.

| Recipe / DSL | What it covers |
|---|---|
| `nav-shell` | Left-sidebar navigation shell — header, collapsible sidebar, view switching |
| `file-crud` | JSON file-based persistence — no database, real-time Socket.io sync, chokidar watcher |
| `nav-shell` + `file-crud` | Complete CRUD app with nav and file persistence |
| [Domain DSL format](../template/.claude/skills/recipe/references/domain-dsl.md) | How to write a domain DSL — entity fields, namish fields, relationships, nav mapping |
| [care-provider-operations](../template/.claude/skills/recipe/domains/care-provider-operations.md) | Example domain: NDIS residential care (6 entities) |
| [youtube-launch-optimizer](../template/.claude/skills/recipe/domains/youtube-launch-optimizer.md) | Example domain: YouTube content production pipeline (5 entities) |
