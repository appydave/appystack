# AppyStack Architecture Guide

**Version**: 1.0
**Date**: 2026-07-12
**Status**: Production-proven across 4 applications

---

## What is AppyStack?

AppyStack is a production-ready full-stack architecture for building real-time web applications. It codifies patterns proven across 4 production apps (FliGen, FliHub, FliDeck, Storyline App) into a reusable, opinionated stack.

**The RVETS Stack**: React, Vite, Express, TypeScript, Socket.io

### Why AppyStack?

| Problem | AppyStack Solution |
|---------|-------------------|
| Inconsistent project structure | Standardized npm workspaces monorepo |
| No testing culture | Vitest pre-configured for client and server |
| Config drift across projects | Shared `@appydave/appystack-config` package |
| Runtime env var crashes | Zod validation at startup |
| Unstructured logging | Pino with request tracing |
| Manual quality checks | ESLint 9 + Prettier + GitHub Actions CI |
| Real-time data requirements | Socket.io integrated from day one |

---

## Table of Contents

- [What is AppyStack?](#what-is-appystack)
- [Capabilities & Limitations](#capabilities--limitations)
- [Core Architecture](#core-architecture)
- [Technology Stack](#technology-stack)
- [Configuration Patterns](#configuration-patterns)
- [Environment Validation (Zod)](#environment-validation-zod)
- [Structured Logging (Pino)](#structured-logging-pino)
- [Real-time Architecture (Socket.io)](#real-time-architecture-socketio)
- [Testing Patterns](#testing-patterns)
- [CI/CD Pipeline](#cicd-pipeline)
- [Common Pitfalls](#common-pitfalls)
- [Comparison with Other Stacks](#comparison-with-other-stacks)
- [When to Use AppyStack](#when-to-use-appystack)
- [Security](#security)
- [npm Publishing (@appydave/appystack-config)](#npm-publishing-appydaveappystack-config)
- [Roadmap](#roadmap)
- [Production Apps](#production-apps)
- [Adding ShadCN/UI](#adding-shadcnui)

---

## Capabilities & Limitations

### What AppyStack Includes
- TypeScript end-to-end with shared types across client, server, and shared packages
- REST API with Zod request validation and structured error responses
- Real-time bidirectional communication via Socket.io
- Structured logging with Pino and pino-http
- Environment variable validation with Zod at startup
- Production Docker build with multi-stage Dockerfile
- CI workflow (GitHub Actions) that installs, builds the shared package, then runs typecheck, lint, and tests
- Shared ESLint, TypeScript, Vitest, and Prettier configs via @appydave/appystack-config

### What AppyStack Does NOT Include

These are intentionally out of scope — add them yourself:

| Concern | Choose your own |
|---------|----------------|
| Database / ORM | Prisma, Drizzle, Kysely, raw SQL |
| Authentication | JWT, OAuth 2.0, sessions, Passport.js |
| State management | Zustand, Redux, TanStack Query, React Context |
| API documentation | Swagger/OpenAPI, tRPC |
| File uploads | multer, busboy |
| Email | Resend, Nodemailer, SendGrid |
| Background jobs | BullMQ, pg-boss, cron |
| GraphQL | Not applicable — AppyStack is REST + Socket.io |

This is not a limitation — it's a deliberate boundary. AppyStack gives you a production-ready foundation; you layer in what your app actually needs.

---

## Core Architecture

### Monorepo Structure

Every AppyStack project uses npm workspaces with a three-package structure:

```
project-root/
├── package.json              # Root workspace config
├── eslint.config.js          # ESLint 9 flat config (root-level)
├── .prettierrc               # Prettier config
├── .prettierignore
├── .env.example              # Environment template
├── .github/workflows/ci.yml  # CI pipeline
├── CLAUDE.md                 # AI documentation
├── README.md
├── client/                   # React frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── contexts/
│       ├── utils/
│       ├── styles/
│       └── test/
│           └── setup.ts
├── server/                   # Express backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── index.ts
│       ├── config/
│       │   ├── env.ts        # Zod environment validation
│       │   └── logger.ts     # Pino logger
│       ├── middleware/
│       │   ├── requestLogger.ts
│       │   ├── errorHandler.ts
│       │   ├── rateLimiter.ts
│       │   └── validate.ts
│       ├── routes/
│       ├── services/
│       ├── utils/
│       └── types/
└── shared/                   # Shared TypeScript types
    ├── package.json
    ├── tsconfig.json
    └── src/
        └── types.ts
```

### Package Naming Convention

Scoped packages with `@projectname/workspace` pattern:

```json
{ "name": "@flideck/client" }
{ "name": "@flideck/server" }
{ "name": "@flideck/shared" }
```

### Port Allocation

Ports are allocated in 100s to avoid conflicts when running multiple projects:

| Project | Client | Server | Range |
|---------|--------|--------|-------|
| FliHub | Vite default | 5101 | 510x |
| FliDeck | 5200 | 5201 | 520x |
| Storyline App | 5300 | 5301 | 530x |
| FliGen | 5400 | 5401 | 540x |
| **Available** | 5500 | 5501 | 550x |
| **Available** | 5600 | 5601 | 560x |

**Rule**: Client port = `5X00`, Server port = `5X01`.

---

## Key Design Decisions

The decisions that shaped AppyStack, with the alternatives weighed against each.

### String replacement over a templating engine
The CLI substitutes placeholder values (scope, ports, description) with `content.split(from).join(to)`. Zero dependencies, easy to audit, and the template stays a real, runnable project.
- *Alternative:* Mustache / Handlebars / EJS. *Rejected:* adds a runtime dependency, forces every template file to be valid template syntax, and the handful of substitution points doesn't justify it. *Trade-off:* if placeholder strings change between versions, the upgrade code must keep pace.

### Two CLI packages + one config package
`create-appystack` (scaffold + upgrade logic), `appystack-upgrade` (thin wrapper for the clean `npx appystack-upgrade` command), and `@appydave/appystack-config` (shared configs).
- *Alternative:* one bundled monorepo package. *Rejected:* config changes (lint/TS rules) are frequent while CLI changes are rare — coupling them forces needless version bumps. The three publish independently; publish only what changed.

### File classification tiers in the upgrade tool
Every template file is `auto` (safe overwrite) / `recipe` (skill file, diff-and-confirm) / `never` (developer-owned) / `owned` (project-specific), rather than prompting on everything or blindly overwriting.
- *Alternative:* prompt on every changed file (`degit --force` style). *Rejected:* prohibitively noisy — developers stop reading and blanket-accept or blanket-skip. The tiers are what make `npx appystack-upgrade` safe to run on a live codebase.

### Data directory at the monorepo root, not in `server/src/`
Runtime-written files live at `<project-root>/data/`.
- *Alternative:* `server/data/`. *Rejected:* nodemon watches `server/**`; writing data there triggers a server restart on every write → `EADDRINUSE` crashes.

### Overmind for process management
`scripts/start.sh` launches client + server as Overmind-managed processes (attach/detach, per-process restart, survives terminal close).
- *Alternative:* the `concurrently` npm package. *Rejected for `start.sh`:* no attach/detach, no per-process restart, dies when the terminal closes, interleaved logs. (`concurrently` is still used for the plain `npm run dev` path.)

### Skills bundled into the template
Recipe, app-idea, and mochaccino ship inside the template at `.claude/skills/`, so every scaffolded app has them from commit zero.
- *Alternative:* a separately installable skills package. *Rejected:* skills need project context (file structure, types, routes) to work — co-locating them with the code they read is the point.

## Maintainer Mental Model

How to think about this repo when working in it:

- **This repo produces applications; it does not run as one.** There is no dev server to start here — the *template is the product*. The feedback loop for a template change is: edit root `template/` → `npm run sync` → scaffold a test app → verify. "Green in the template" is not "green when scaffolded" (the template ships `.env.example`, not `.env`) — see [`docs/kdd/learnings/dotenv-override-clobbers-env-tests.md`](kdd/learnings/dotenv-override-clobbers-env-tests.md).
- **Recipes are intelligence, not code generation.** A recipe is a *specification* of how a class of app should be structured; the reference file in `.claude/skills/recipe/references/` is the contract. Claude reads it, understands the target project, and generates code that fits — treat the reference as the source of truth, not any one generated output.
- **The upgrade tier system is the safety guarantee.** `auto/recipe/never/owned` is what makes `npx appystack-upgrade` safe on a production codebase: app code (`client/src/`, `server/src/`) is `never` touched, config/CI land silently as `auto`, skill files show a diff as `recipe`. Know a file's tier before running an upgrade.
- **The three npm packages have independent lifecycles.** Config changes need a config publish; template changes need a `create-appystack` publish (auto-syncs the template); the upgrade wrapper rarely changes. Never publish all three for a one-package change.
- **Port mismatches are a class of bug, not incidents.** Check the port registry (`~/dev/ad/brains/brand-dave/app-port-registry.md`) before assigning ports; treat a silent port mismatch as the first hypothesis when Socket.io hangs on "Loading…". See the dotenv-override and port-conflict learnings in [`docs/kdd/learnings/`](kdd/learnings/README.md).

## Technology Stack

### Core (Required)

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Frontend** | React | ^19.2.7 | Component model, ecosystem, React 19 features |
| **Build** | Vite | ^7.3.6 | Fast HMR, ESM-native, excellent DX |
| **Styling** | TailwindCSS | ^4.3.2 | Utility-first, v4 uses `@import` syntax |
| **Backend** | Express | ^5.0.1 | Mature, middleware ecosystem, Express 5 async |
| **Real-time** | Socket.io | ^4.8.1 | WebSocket with fallbacks, room support |
| **Language** | TypeScript | ^5.7.3 | Type safety across full stack |
| **Runtime** | Node.js | >=20.0.0 | LTS, ESM support |

### Quality Tooling (Required)

| Tool | Version | Purpose |
|------|---------|---------|
| **Vitest** | ^4.1.10 | Unit/integration testing (client + server) |
| **Testing Library** | ^16.3.0 | React component testing |
| **Supertest** | ^7.0.0 | HTTP endpoint testing |
| **ESLint** | ^9.39.5 | Code linting (flat config) |
| **Prettier** | ^3.9.5 | Code formatting |
| **Zod** | ^3.24.1 | Environment validation, runtime schemas |
| **Pino** | ^9.6.0 | Structured logging |

### Security Middleware (Required for Production)

| Library | Version | Purpose |
|---------|---------|---------|
| **Helmet** | ^8.3.0 | Security headers |
| **Compression** | ^1.7.5 | Gzip response compression |
| **CORS** | ^2.8.5 | Cross-origin request control |

### State & Routing (Optional)

| Library | Version | Use Case |
|---------|---------|----------|
| **TanStack Query** | ^5.87.1 | Server state, caching, refetching |
| **React Router** | ^7.8.2 | Client-side routing |
| **Sonner** | ^1.7.1 | Toast notifications |

### Development Tools (Required)

| Tool | Version | Purpose |
|------|---------|---------|
| **tsx** | ^4.23.0 | TypeScript execution (dev) |
| **nodemon** | ^3.1.14 | Auto-restart server on changes |
| **concurrently** | ^10.0.3 | Run client + server simultaneously |

---

## Configuration Patterns

### Root package.json

```json
{
  "name": "@projectname/root",
  "private": true,
  "type": "module",
  "workspaces": ["client", "server", "shared"],
  "scripts": {
    "dev": "npm run build -w shared && concurrently --kill-others -n server,client -c blue,green \"npm run dev -w server\" \"npm run dev -w client\"",
    "build": "npm run build -w shared && npm run build -w server && npm run build -w client",
    "start": "npm start -w server",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "test": "npm test -w client && npm test -w server",
    "test:coverage": "npm run test:coverage -w client && npm run test:coverage -w server",
    "test:ui": "npm run test:ui -w client",
    "clean": "rm -rf client/dist server/dist node_modules */node_modules"
  },
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  }
}
```

### Vite Configuration

```typescript
// client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5200, // Change per project
    proxy: {
      '/api': {
        target: 'http://localhost:5201',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5201',
        ws: true,
      },
    },
  },
});
```

### TailwindCSS v4

```css
/* client/src/styles/index.css */
@import "tailwindcss";
@source "./**/*.{js,ts,jsx,tsx}";
```

> **Gotcha**: TailwindCSS v4 uses `@import "tailwindcss"` — NOT `@tailwind base/components/utilities` from v3. Use `@source` for content detection, not the `content` array in config.

### TypeScript Configuration

**Client** (`client/tsconfig.json`):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "strict": true,
    "jsx": "react-jsx",
    "noEmit": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"]
}
```

**Server** (`server/tsconfig.json`) — extends the shared node config and adds path aliases:
```json
{
  "extends": "@appydave/appystack-config/typescript/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@routes/*": ["src/routes/*"],
      "@middleware/*": ["src/middleware/*"],
      "@config/*": ["src/config/*"],
      "@services/*": ["src/services/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### ESLint 9 Flat Config

```javascript
// eslint.config.js (root level)
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/coverage/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, ...globals.es2022 },
    },
    plugins: { '@typescript-eslint': typescript },
    rules: {
      ...js.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
    },
  },
  {
    files: ['client/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
];
```

> **Critical**: ESLint 9 requires flat config (`eslint.config.js`). Legacy `.eslintrc.*` files are silently ignored. The `--ext` flag is also removed. See [Common Pitfalls](#common-pitfalls) for details.

### Prettier

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always"
}
```

```
// .prettierignore
dist
build
node_modules
coverage
package-lock.json
```

---

## Environment Validation (Zod)

Every server uses Zod to validate environment variables at startup:

```typescript
// server/src/config/env.ts
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Precedence must flip between test and runtime:
//  - Under test, values a test sets on process.env must win (override OFF).
//  - At runtime, .env must win over any stale or injected PORT (override ON).
const underTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env'), override: !underTest });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5501),
  CLIENT_URL: z.string().default('http://localhost:5500'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
};
```

> **Note**: See `docs/kdd/learnings/dotenv-override-clobbers-env-tests.md` for why `override` is conditional.

**Benefits**: Catches config errors at startup (not in production), provides TypeScript autocomplete, self-documents required variables.

---

## Structured Logging (Pino)

```typescript
// server/src/config/logger.ts
import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
});
```

```typescript
// server/src/middleware/requestLogger.ts
import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import { logger } from '../config/logger.js';

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
  customLogLevel: (_req, res) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req) => `${req.method} ${req.url} completed`,
});
```

---

## Real-time Architecture (Socket.io)

### Server Setup

```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: env.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');

  socket.on('join:room', (roomId: string) => {
    socket.join(roomId);
  });

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});

export { io };
```

### Client Hook

```typescript
// client/src/hooks/useSocket.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io('http://localhost:5201');
    socketInstance.on('connect', () => setConnected(true));
    socketInstance.on('disconnect', () => setConnected(false));
    setSocket(socketInstance);
    return () => { socketInstance.close(); };
  }, []);

  return { socket, connected };
}
```

---

## Testing Patterns

### Client Testing (Vitest + Testing Library)

```typescript
// client/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
```

```typescript
// client/src/test/setup.ts
import '@testing-library/jest-dom';
```

```typescript
// Example component test
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

### Server Testing (Vitest + Supertest)

```typescript
// server/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
```

```typescript
// Example API test
import { describe, it, expect } from 'vitest';
import supertest from 'supertest';

describe('Health Check', () => {
  it('GET /health returns ok', async () => {
    const response = await supertest(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
```

---

## CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    name: Lint, typecheck, test
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm install

      - name: Build shared
        run: npm run build --workspace=shared

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test
```

---

## Common Pitfalls

Lessons learned from implementing AppyStack across 4 production apps. These are real issues encountered during development.

### ESLint 9 Flat Config (Critical)

**Problem**: ESLint 9 removed support for `.eslintrc.*` files. If you install ESLint 9 but create `.eslintrc.cjs`, ESLint silently ignores it and reports "couldn't find a config file."

**Solution**:
- Use `eslint.config.js` (flat config format) at the root
- Remove the `--ext` flag from lint scripts (removed in v9)
- Use `@eslint/js@^9.0.0` (NOT `@10.x` which requires ESLint 10)
- Lint script: `"lint": "eslint ."` (no `--ext`)

### TailwindCSS v4 Migration

**Problem**: v4 uses completely different syntax from v3.

**Solution**:
- Use `@import "tailwindcss"` instead of `@tailwind` directives
- Use `@source` directive for content scanning
- Use `@tailwindcss/vite` plugin instead of PostCSS
- Safelist classes for dynamically rendered content: `@source inline("modal-classes")`

### Missing Dependencies After Config

**Problem**: Config files reference dependencies that were never installed. Tests appear to work until you run `test:coverage`.

**Solution**: Always install AND run every command after setup. The verification checklist is:
1. Install dependencies in ALL workspaces
2. Create config files
3. Add scripts to package.json
4. **Run every command at least once**
5. Verify output matches expectations

### Prettier Must Be Run

**Problem**: Creating `.prettierrc` doesn't format files. CI `format:check` will fail if `format` was never run.

**Solution**: After setting up Prettier, immediately run `npm run format` to format all files, then commit the result.

### Configuration Does Not Equal Verification

**Key lesson from FliGen post-mortem**: Of 5 "Quick Wins" implemented, only 2 were fully functional on first attempt. ESLint was completely broken, Prettier was never run, and CI would have failed immediately.

**Rule**: Before claiming any tool is "complete":
- [ ] Dependencies installed in all workspaces
- [ ] Configuration files created
- [ ] Scripts added to package.json
- [ ] **Command actually run and output verified**
- [ ] Success message confirmed
- [ ] Failure cases tested

---

## Comparison with Other Stacks

Analysis based on 5 high-quality repos with 50,000+ combined GitHub stars.

### Feature Comparison

| Feature | AppyStack | bulletproof-react | create-t3-turbo | express-typescript-2024 |
|---------|-----------|------------------|----------------|------------------------|
| **Frontend Architecture** | Layer-based | Feature-based | Framework-agnostic | N/A |
| **Backend Framework** | Express 5 | N/A | tRPC | Express |
| **Monorepo** | npm workspaces | Single app | Turborepo | Single app |
| **Testing** | Vitest | Vitest + MSW + Playwright | Vitest | Vitest |
| **Linting** | ESLint 9 | ESLint | ESLint (shared pkg) | Biome |
| **Logging** | Pino | N/A | N/A | Pino |
| **Env Validation** | Zod | N/A | Zod (T3 Env) | Zod |
| **Real-time** | Socket.io | N/A | N/A | N/A |
| **API Docs** | Manual | N/A | N/A | OpenAPI (Zod-to-OpenAPI) |

### What AppyStack Borrows

| Source | Pattern Adopted |
|--------|----------------|
| **bulletproof-react** | Testing setup patterns, TanStack Query conventions |
| **express-typescript-2024** | Zod env validation, Pino logging, request tracing |
| **create-t3-turbo** | Shared config packages, CI/CD patterns, monorepo structure |
| **turbo** | Task dependency patterns, build caching strategies |
| **vite-express** | Supertest patterns for backend testing |

### Planned Improvements (from external analysis)

| Improvement | Source | Status |
|-------------|--------|--------|
| Feature-based architecture | bulletproof-react | Planned (Q2 2026) |
| Shared tooling packages | create-t3-turbo | In progress (`@appydave/appystack-config`) |
| OpenAPI auto-generation | express-typescript-2024 | Planned (Q3 2026) |
| MSW for API mocking | bulletproof-react | Planned (Q2 2026) |
| ServiceResponse pattern | express-typescript-2024 | Planned (Q2 2026) |

---

## When to Use AppyStack

### Use AppyStack When

- Building production applications with server-side logic
- Need real-time features (WebSocket/Socket.io)
- Multiple workspaces needed (client/server/shared)
- Team collaboration expected
- Long-term maintenance planned

### Don't Use AppyStack When

- Building demos or prototypes (use simpler templates)
- Time-constrained under 2 days
- Single-page static tool (use Vite + React only)
- Project doesn't need a server
- External SDK dictates architecture

### Complexity Levels

```
Level 1: Single HTML file
  → Demos, SDK testing, quick prototypes

Level 2: Vite + React (no server)
  → Static apps, client-only tools

Level 3: AppyStack (this architecture)
  → Production apps with real-time features
```

---

## Security

### Git Hooks (Gitleaks)

```bash
#!/bin/bash
# .git/hooks/pre-commit
if ! command -v gitleaks &> /dev/null; then
  echo "gitleaks not found. Install: brew install gitleaks"
  exit 1
fi
gitleaks protect --staged --verbose
```

### .gitignore

```gitignore
node_modules/
dist/
build/
coverage/
.env
.env.local
config.json
.DS_Store
*.log
package-lock.json
```

---

## npm Publishing (`@appydave/appystack-config`)

The shared config package is published to npm under the `@appydave` scope so consumer projects can install it with a standard `npm install` instead of `file:` paths.

### Package Identity

| Field | Value |
|-------|-------|
| **npm scope** | `@appydave` (requires npm org or paid account) |
| **Package name** | `@appydave/appystack-config` |
| **Registry** | `https://registry.npmjs.org` (public npm) |
| **Access** | Public |
| **Source location** | `config/` directory in this repo |

### Current State (migration complete — published)

The `config/package.json` is fully renamed and published:
- `"name": "@appydave/appystack-config"` — live on npm as of 2026-02-26
- `"version": "1.0.3"` — current published version
- `"files"` field present — controls published output
- `"repository"` field present — points to GitHub repo
- No `"main"` field — all exports via `"exports"` map

### Target package.json

```json
{
  "name": "@appydave/appystack-config",
  "version": "1.0.0",
  "description": "Shared ESLint, TypeScript, Vitest, and Prettier configs for AppyStack (RVETS stack)",
  "type": "module",
  "exports": {
    "./eslint/base": "./eslint/base.config.js",
    "./eslint/react": "./eslint/react.config.js",
    "./vitest/server": "./vitest/server.config.ts",
    "./vitest/client": "./vitest/client.config.ts",
    "./typescript/base": "./typescript/base.json",
    "./typescript/react": "./typescript/react.json",
    "./typescript/node": "./typescript/node.json",
    "./prettier": "./prettier/.prettierrc"
  },
  "files": [
    "eslint/",
    "vitest/",
    "typescript/",
    "prettier/",
    "README.md"
  ],
  "peerDependencies": {
    "@eslint/js": "^9.17.0",
    "@typescript-eslint/eslint-plugin": "^8.20.0",
    "@typescript-eslint/parser": "^8.20.0",
    "eslint": "^9.17.0",
    "eslint-plugin-react": "^7.37.3",
    "eslint-plugin-react-hooks": "^5.1.0",
    "globals": "^15.14.0",
    "prettier": "^3.4.2",
    "typescript": "^5.7.3",
    "vitest": "^4.1.1"
  },
  "keywords": [
    "appydave",
    "appystack",
    "config",
    "eslint",
    "eslint-config",
    "vitest",
    "typescript",
    "prettier",
    "react",
    "express",
    "boilerplate",
    "starter"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/appydave/appystack.git",
    "directory": "config"
  },
  "homepage": "https://github.com/appydave/appystack#readme",
  "author": "David Cruwys",
  "license": "MIT"
}
```

### npm Org Setup

Before publishing, the `@appydave` npm org must exist:

1. **Check if org exists**: `npm org ls appydave` (will error if it doesn't)
2. **Create org** (if needed): Go to https://www.npmjs.com/org/create or run `npm org create appydave`
3. **Authenticate**: `npm login` (must be logged in as an account that owns the org)
4. **Verify**: `npm whoami` should show the authenticated user

> **Note**: npm scoped packages (`@scope/name`) are private by default. Use `--access public` when publishing to make it publicly installable.

### Publishing Workflow

```bash
# From the config/ directory
cd config/

# 1. Verify what will be published
npm pack --dry-run
# Should list only: eslint/, vitest/, typescript/, prettier/, README.md, package.json

# 2. Publish (first time)
npm publish --access public

# 3. Verify on npm
npm view @appydave/appystack-config

# 4. Test install from a consumer project
cd /path/to/consumer-project
npm install --save-dev @appydave/appystack-config
```

### Version Bumping

```bash
cd config/

# Patch (1.0.0 → 1.0.1) — bug fixes, dependency updates
npm version patch

# Minor (1.0.0 → 1.1.0) — new configs added, non-breaking
npm version minor

# Major (1.0.0 → 2.0.0) — breaking changes to existing configs
npm version major

# Then publish
npm publish --access public
```

### Consumer Project Migration

When consumers switch from `file:` install to npm:

**Before** (local file reference):
```bash
npm install --save-dev file:/Users/davidcruwys/dev/ad/apps/appystack/config
```

**After** (npm registry):
```bash
npm install --save-dev @appydave/appystack-config
```

Consumer import paths use `@appydave/appystack-config/...` (migration from `@flivideo/config` is complete):

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
// package.json prettier
{ "prettier": "@appydave/appystack-config/prettier" }
```

### Automated Publishing (GitHub Actions)

Optional: automate publishing on version tags.

```yaml
# .github/workflows/publish.yml
name: Publish to npm

on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: config
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Setup**: Add `NPM_TOKEN` as a GitHub repository secret (generate at https://www.npmjs.com/settings/tokens).

### GitHub Repository Discovery

To make the repo discoverable:

1. **GitHub Topics** — Add to repo settings: `appystack`, `react`, `vite`, `express`, `typescript`, `socket-io`, `boilerplate`, `starter`, `eslint-config`, `monorepo`
2. **GitHub Template** — In repo settings, check "Template repository" to enable "Use this template" button (applicable once a template app is added)
3. **README badges** — Add npm version badge: `[![npm](https://img.shields.io/npm/v/@appydave/appystack-config)](https://www.npmjs.com/package/@appydave/appystack-config)`

### CLI Scaffolder (`create-appystack`) — shipped

The `create-*` pattern is the dominant discovery mechanism for boilerplates. `create-appystack` is
published on npm (v0.4.14). Users run:

```bash
npx create-appystack@latest my-new-app
```

The scaffolder:
1. Prompts for project name, scope, port range, and description
2. Copies template files with variable substitution
3. Sets up the client/server/shared workspaces
4. Ships an `appystack-upgrade` bin so consumer apps can pull in later template improvements

It also depends on the published `@appydave/appystack-config` package for shared ESLint/TS/Vitest/Prettier configs.

---

## Roadmap

### Implemented

- Core monorepo architecture (npm workspaces)
- Full quality tooling (Vitest, ESLint 9, Prettier)
- CI (GitHub Actions)
- Environment validation (Zod)
- Structured logging (Pino)
- Shared config package `@appydave/appystack-config` — published to npm (v1.0.3)
- Consumer projects migrated from `file:` to npm install
- `create-appystack` CLI scaffolder — published to npm (v0.4.14)
- `appystack-upgrade` bin for pulling template improvements into consumer apps
- MSW for API mocking in tests (msw ^2.15.0)
- Request tracing with request IDs (`middleware/requestLogger` `genReqId`)

### Planned

- Feature-based frontend architecture (from bulletproof-react)
- ServiceResponse pattern for consistent API responses
- Advanced error handling system (AppError classes)
- OpenAPI auto-generation from Zod schemas
- Shared UI component library

---

## Production Apps

| App | Purpose | Ports | Key Features |
|-----|---------|-------|-------------|
| **FliGen** | 12 Days of Claudemas harness | 5400/5401 | Reference implementation |
| **FliHub** | Video recording workflows | default/5101 | Monaco editor, file watching |
| **FliDeck** | Presentation viewer | 5200/5201 | Config hot-reload, HTML parsing |
| **Storyline App** | Video content planning | 5300/5301 | Image processing (Sharp), multi-project |

---

## Adding ShadCN/UI

AppyStack ships with the `cn()` utility (`clsx` + `tailwind-merge`) and the `@/*` path alias pre-configured — the two prerequisites ShadCN requires. Adding ShadCN components to a consumer project is three commands.

### Prerequisites (already in the template)

- `clsx` + `tailwind-merge` installed, `src/lib/utils.ts` with `cn()` exported
- `@/*` path alias in `vite.config.ts` and `tsconfig.json`
- TailwindCSS v4 installed

### Adding ShadCN to a consumer project

After running `npm run customize`:

```bash
# 1. Initialise shadcn (run from the client/ workspace)
cd client
npx shadcn@latest init
```

Answer the prompts:
- Style: **New York** (recommended) or Default
- Base color: your choice
- CSS variables: **yes**

```bash
# 2. Add components as needed
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add form        # wraps react-hook-form (already installed)
```

```bash
# 3. Use in your components
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
```

### CSS variable integration

AppyStack's `index.css` already uses ShadCN's semantic variable naming with OKLCH values: `--color-background`, `--color-foreground`, `--color-card`, `--color-border`, `--color-primary`, `--color-primary-foreground`, `--color-muted`, `--color-muted-foreground`, `--color-destructive`, and `--color-destructive-foreground`.

**The integration is seamless.** Running `shadcn init` writes these same variable names — there is no conflicting layer to reconcile.

When `shadcn init` prompts to overwrite the CSS variables:
- Choose **yes** to adopt ShadCN's default OKLCH palette (light/neutral grays by default)
- Choose **no** (or restore after) to keep AppyStack's dark terminal theme — the OKLCH values from the template's `@theme` block are what give it the dark palette

ShadCN components like `Button`, `Dialog`, and `Input` automatically use `--primary`, `--card`, and `--border`, and will therefore inherit whichever theme is in the `@theme` block.

### What stays, what changes

| | Stays | Changes |
|---|---|---|
| `cn()` in `lib/utils.ts` | ✅ | — |
| `@/*` path alias | ✅ | — |
| Existing components | ✅ | — |
| `components/ui/` | — | Created by shadcn init |
| `index.css` | ✅ | Gets shadcn's `@theme inline` block added |
| `components.json` | — | Created by shadcn init |

### Why AppyStack doesn't pre-generate ShadCN components

The template ships without pre-generated ShadCN components because:
1. ShadCN's default palette (light/neutral grays) clashes with AppyStack's dark terminal theme out of the box
2. Pre-generated components without the CLI context make it hard to add more later
3. Component choices are per-project — not every app needs the same set

The `cn()` utility and path alias give you the foundation. ShadCN components are one `npx shadcn@latest add` away.

---

**See also**: [requirements.md](./requirements.md) for setup instructions and implementation checklist.
