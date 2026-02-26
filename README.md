```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  ██████╗ ██╗   ██╗███████╗████████╗███████╗                 ║
║  ██╔══██╗██║   ██║██╔════╝╚══██╔══╝██╔════╝                 ║
║  ██████╔╝╚██╗ ██╔╝█████╗     ██║   ███████╗                 ║
║  ██╔══██╗ ╚████╔╝ ██╔══╝     ██║   ╚════██║                 ║
║  ██║  ██║  ╚██╔╝  ███████╗   ██║   ███████║                 ║
║  ╚═╝  ╚═╝   ╚═╝   ╚══════╝   ╚═╝   ╚══════╝                 ║
║                                                              ║
║  AppyStack                                                   ║
║  React · Vite · Express · TypeScript · Socket.io            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178c6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646cff?style=flat-square&logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?style=flat-square&logo=socketdotio&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)

**Production-ready full-stack monorepo — real-time, type-safe, quality tooling from day one.**

</div>

---

## What Is AppyStack?

AppyStack is two things in one repository:

| | What | Purpose |
|---|---|---|
| `config/` | Shared ESLint, TypeScript, Vitest & Prettier configs | One source of truth across all your projects |
| `template/` | RVETS monorepo boilerplate | Copy once, start building immediately |

---

## The Architecture

```
client/   React 19 + Vite 7 + TailwindCSS v4     →  :5500
            ↕ dev proxy  (/api  /health  /socket.io)
server/   Express 5 + Socket.io + Pino + Zod      →  :5501
            ↕ imports
shared/   TypeScript interfaces only
```

**Core stack:** React 19 · Vite 7 · Express 5 · TypeScript 5.7+ · Socket.io 4.8

**Quality layer:** Vitest · ESLint 9 flat config · Prettier · Zod · Pino

**Structure:** npm workspaces monorepo — `client` / `server` / `shared`

---

## Quick Start

```bash
# Copy the template and start developing
cp -r template/ my-new-app
cd my-new-app
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Start client + server concurrently |
| `npm run build` | Build shared → server → client |
| `npm test` | Run all tests |
| `npm run lint` | ESLint across all workspaces |
| `npm run typecheck` | TypeScript across all workspaces |

---

## Repository Structure

```
appystack/
├── config/                   # @appydave/appystack-config  (npm package)
│   ├── eslint/               #   base.config.js + react.config.js
│   ├── typescript/           #   base.json · react.json · node.json
│   ├── vitest/               #   server.config.ts
│   └── prettier/             #   .prettierrc + .prettierignore
│
├── template/                 # RVETS boilerplate  (copy to start a new app)
│   ├── client/               #   React 19 + Vite 7 + TailwindCSS v4
│   ├── server/               #   Express 5 + Socket.io + Pino
│   └── shared/               #   TypeScript interfaces only
│
└── docs/                     # Architecture decisions + implementation guides
    ├── architecture.md       #   Complete RVETS architecture reference
    ├── requirements.md       #   Setup checklist + verification procedures
    ├── review/               #   Research: testing, DX, security, sockets
    └── historical/           #   Post-mortems + implementation guides
```

---

## Using the Config Package

Install from npm (once published):

```bash
npm install --save-dev @appydave/appystack-config
```

Or install locally via file reference:

```bash
npm install --save-dev file:/path/to/appystack/config
```

### ESLint

```javascript
// eslint.config.js
import appyConfig from '@appydave/appystack-config/eslint/react';  // or /eslint/base
export default [...appyConfig];
```

### TypeScript

```json
{ "extends": "@appydave/appystack-config/typescript/react" }
```

### Prettier

```json
{ "prettier": "@appydave/appystack-config/prettier" }
```

### Vitest

```typescript
import { mergeConfig } from 'vitest/config';
import appyConfig from '@appydave/appystack-config/vitest/server';
export default mergeConfig(appyConfig, { /* your overrides */ });
```

---

## Proven in Production

AppyStack powers 4 production applications:

| App | Purpose |
|---|---|
| **FliGen** | 12 Days of Claudemas generation harness |
| **FliHub** | Video recording + asset workflows |
| **FliDeck** | Presentation viewer |
| **Storyline App** | Video content planning |

All ship with ✅ automated tests &nbsp;·&nbsp; ✅ CI/CD &nbsp;·&nbsp; ✅ type-safe config &nbsp;·&nbsp; ✅ structured logging

---

## Philosophy

> **Start production-ready. Don't bolt on quality later.**

- **Consistency** — same architecture, same patterns across every project
- **Type safety** — shared interfaces flow from server to client via `shared/`
- **Real-time built in** — Socket.io wired and working from the first commit
- **Quality enforced** — linting, formatting, and tests are non-negotiable defaults

---

*Part of the [AppyDave](https://github.com/appydave) ecosystem*
