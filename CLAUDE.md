# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is AppyStack?

AppyStack is a shared configuration package and architecture reference for the RVETS stack (React, Vite, Express, TypeScript, Socket.io). It provides reusable ESLint, TypeScript, Vitest, and Prettier configs consumed by production apps (FliGen, FliHub, FliDeck, Storyline App).

**Jump alias**: `japp-stack`

## Repository Structure

This is NOT an application — it's a config package + documentation hub.

- `create-appystack/` — The `create-appystack` npm package (published as v0.1.3 on npm)
  - `bin/index.js` — CLI entry point (see usage below)
  - `scripts/sync-template.js` — Copies `../template/` → `./template/` (run before publish)
  - `template/` — Committed copy of root `template/` (synced, excludes node_modules/dist/coverage)
  - To publish: `cd create-appystack && npm publish --access public`
  - To sync template after changes: `cd create-appystack && npm run sync`
- `config/` — The `@appydave/appystack-config` npm package (published as v1.0.3 on npm)
  - `eslint/base.config.js` — ESLint 9 flat config for Node/server projects
  - `eslint/react.config.js` — ESLint 9 flat config for React projects (extends base + adds React/hooks rules)
  - `vitest/server.config.ts` — Vitest config for server-side testing
  - `typescript/base.json` — Base TypeScript config (ES2022, bundler resolution, strict)
  - `typescript/react.json` — Extends base with DOM libs, JSX, noEmit
  - `typescript/node.json` — Extends base with outDir/rootDir for compilation
  - `prettier/.prettierrc` — Prettier settings (single quotes, semi, 100 width)
  - `prettier/.prettierignore` — Standard ignore patterns
- `docs/` — Primary documentation (see `docs/README.md` for full index)
  - **Guides**: `getting-started.md`, `first-feature.md`, `testing-guide.md`, `troubleshooting.md`
  - **Reference**: `architecture.md`, `requirements.md`, `environment.md`, `api-design.md`, `socket-io.md`, `authentication.md`, `extending-configs.md`, `deployment.md`, `database.md`
  - `plans/` — Claude Code planning documents
  - `historical/` — Reference only. Do not treat as source of truth.

## Scaffolding a New Project

```bash
# Interactive (prompts for scope, ports, description)
npx create-appystack@latest my-app

# One-liner with flags (server port defaults to --port + 1)
npx create-appystack@latest my-app --scope @myorg --port 5500 --description "My app"
```

Flags: `--scope @myorg`, `--port <client-port>`, `--description "..."`. Server port always prompts (pre-filled as port+1).

## How Consumer Projects Use @appydave/appystack-config

```bash
npm install --save-dev @appydave/appystack-config
```

Consumer usage:
```javascript
// eslint.config.js
import appyConfig from '@appydave/appystack-config/eslint/react';
export default [...appyConfig];
```

```json
// tsconfig.json
{ "extends": "@appydave/appystack-config/typescript/react" }
```

```json
// package.json
{ "prettier": "@appydave/appystack-config/prettier" }
```

## Key Architecture Decisions

- **ESLint 9 flat config only** — No `.eslintrc.*` files. ESLint 9 silently ignores legacy configs. No `--ext` flag.
- **TailwindCSS v4 syntax** — Uses `@import "tailwindcss"` and `@source` directive, NOT v3's `@tailwind` directives.
- **npm workspaces** — Consumer apps use client/server/shared three-package monorepo pattern.
- **Port convention** — Client: `5X00`, Server: `5X01`. Allocated in 100s (5100-5499 used).

## npm Publishing

Two packages on npm under the `klueless-io` account:

- **`@appydave/appystack-config`** — v1.0.3 — shared ESLint/TS/Vitest/Prettier configs
- **`create-appystack`** — v0.1.3 — scaffolding CLI (`npx create-appystack@latest my-app`)

**Token:** The `appydave-publish` granular token in `~/.npmrc` expires **31 May 2026**.
Rotate at: npmjs.com → Account → Access Tokens → Generate New Token → Granular, Read+write, All packages, Bypass 2FA, 90-day expiry.
Then run: `npm set //registry.npmjs.org/:_authToken=<new-token>`

Full publish workflow details in `docs/architecture.md` under "npm Publishing".

## File Naming Convention

Use `kebab-case` for markdown files (e.g., `architecture.md`). UPPERCASE only for standard repo files: README.md, CHANGELOG.md, CONTRIBUTING.md, LICENSE.md, CLAUDE.md.
