# AGENTS.md — AppyStack Wave 2 Campaign

## What This Is

Operational knowledge for a Ralph Wiggum Task Agent campaign. Each agent receives this file + a specific work unit.

**Campaign**: AppyStack Wave 2 — CI, npm publish, coverage, template migration, polish
**Worktree**: `/Users/davidcruwys/dev/ad/apps/appystack/.worktrees/appystack-wave2`
**Config package**: `/Users/davidcruwys/dev/ad/apps/appystack/.worktrees/appystack-wave2/config/`
**Template**: `/Users/davidcruwys/dev/ad/apps/appystack/.worktrees/appystack-wave2/template/`
**GitHub repo**: `https://github.com/appydave/appystack`
**npm org**: `@appydave` (owned by klueless-io account)
**npm package name**: `@appydave/appystack-config`

## Build & Run

```bash
cd /Users/davidcruwys/dev/ad/apps/appystack/.worktrees/appystack-wave2/template

# Install
npm install

# Dev (both servers)
npm run dev

# Build (order matters: shared -> server -> client)
npm run build

# Individual workspace commands
npm run build -w shared
npm run build -w server
npm run build -w client
```

## Validation (run after EVERY change)

```bash
cd /Users/davidcruwys/dev/ad/apps/appystack/.worktrees/appystack-wave2/template

# All four must pass before committing
npm run format:check
npm run lint
npm run build
npm test

# Format fix if needed
npm run format
```

## Quality Gates

- All four validation commands pass in template/
- TypeScript compiles without errors (`npm run build`)
- All tests pass (`npm test`) — currently 81 unit + 3 E2E
- No regressions — test count must not decrease
- No `any` types introduced
- Commit with descriptive message after each successful work unit

## Project Structure

```
config/                           # @appydave/appystack-config npm package
  package.json                    # name: @appydave/appystack-config, version: 1.0.0
  eslint/base.config.js           # ESLint 9 flat config for Node/server
  eslint/react.config.js          # ESLint 9 flat config for React
  vitest/server.config.ts         # Vitest config for server
  vitest/client.config.ts         # Vitest config for client (jsdom)
  typescript/base.json
  typescript/react.json
  typescript/node.json
  prettier/.prettierrc
  prettier/.prettierignore
  README.md                       # STALE — needs full rewrite (WU-1)

template/
  package.json                    # Root workspace — @appydave/appystack-template
  eslint.config.js                # Currently INLINED — switch to import after WU-3 (WU-5)
  .env.example / .prettierrc / .gitignore / .prettierignore
  shared/src/types.ts             # ApiResponse, HealthResponse, ServerInfo, SocketEvents
  shared/src/constants.ts         # ROUTES, SOCKET_EVENTS
  server/src/index.ts             # Express + Socket.io + graceful shutdown
  server/src/config/env.ts        # Zod env validation
  server/src/config/logger.ts     # Pino logger
  server/src/middleware/errorHandler.ts
  server/src/middleware/validate.ts
  server/src/middleware/rateLimiter.ts
  server/src/routes/health.ts
  server/src/routes/info.ts
  client/src/main.tsx             # Wrapped in ErrorBoundary
  client/src/App.tsx
  client/src/vite-env.d.ts        # Needs ImportMetaEnv interface (WU-8)
  client/src/hooks/useSocket.ts
  client/src/hooks/useServerStatus.ts
  client/vitest.config.ts         # Coverage thresholds commented out (WU-7)
  server/vitest.config.ts         # Coverage thresholds commented out (WU-7)

.github/workflows/                # DOES NOT EXIST YET (WU-2, WU-3)
```

## Inherited Patterns (from Wave 1 AGENTS.md)

### TypeScript — Strict, no shortcuts
- `strict: true` across all packages
- Use `import type` for type-only imports
- No `any` — use `unknown` and narrow

### Express Routes — Router pattern
```typescript
import { Router } from 'express';
const router = Router();
router.get('/path', (req, res) => { ... });
export default router;
```

### React Components — Function components
```typescript
export default function ComponentName() { ... }
```

### Imports — Use .js extensions for ESM
```typescript
import { env } from './config/env.js';
import type { ApiResponse } from '@appystack-template/shared';
```

### CSS — TailwindCSS v4 syntax only
```css
@import 'tailwindcss';
@source "../";
```

## GitHub Actions Patterns

### CI Workflow — what it should do
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: template
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: template/package-lock.json
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npm run build
      - run: npm test
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

### Publish Workflow — triggered by version tags
```yaml
name: Publish
on:
  push:
    tags:
      - 'v*'

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

## npm Pack / Publish Pattern

```bash
# Verify what will be published (dry run)
cd config && npm pack --dry-run

# Create tarball for local install testing
cd config && npm pack
# → creates appydave-appystack-config-1.0.0.tgz

# Test install from tarball in template
cd template && npm install ../config/appydave-appystack-config-1.0.0.tgz

# Actual publish (requires npm login as klueless-io)
cd config && npm publish --access public
```

## Coverage Threshold Pattern

When uncommenting thresholds, use these values:
```typescript
thresholds: {
  lines: 80,
  functions: 70,
  branches: 70,
  statements: 80,
},
```
Note: functions and branches are lower (70) because they're harder to hit
at 100% on a boilerplate with edge-case handlers.

## import.meta.env Typing Pattern

```typescript
// client/src/vite-env.d.ts — add after existing reference
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

## TypeScript Path Aliases Pattern

```json
// client/tsconfig.json — add to compilerOptions
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@hooks/*":      ["src/hooks/*"],
      "@pages/*":      ["src/pages/*"],
      "@utils/*":      ["src/utils/*"]
    }
  }
}
```

```typescript
// client/vite.config.ts — add to defineConfig
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, 'src/components'),
      '@hooks':      path.resolve(__dirname, 'src/hooks'),
      '@pages':      path.resolve(__dirname, 'src/pages'),
      '@utils':      path.resolve(__dirname, 'src/utils'),
    },
  },
  // ... rest of config
});
```

## Operational Notes (Inherited from Wave 1)

- **Husky init won't work from template/** — `template/` is nested inside the repo, not the git root. Create `.husky/` files manually. This is already done — do not re-run `npx husky init`.
- **Express 5: req.query is read-only** — Use `Object.assign(req.query, value)` not direct assignment. Already fixed in validate.ts — do not regress this.
- **ESLint 9 flat config only** — No `.eslintrc.*` files. Never use `--ext` flag.
- **TailwindCSS v4 syntax only** — `@import 'tailwindcss'`, never `@tailwind base`.

## Anti-Patterns — DO NOT DO THESE

- **NO `npx husky init`** — Already configured. Will break it.
- **NO vi.mock() for hooks** — Test against real lightweight servers
- **NO vi.mock() for fetch** — Use Supertest or real server on port 0
- **NO jest.fn()** — This is Vitest. Use `vi.fn()`
- **NO centralized test/ directories** — Co-locate test files
- **NO TailwindCSS v3 syntax** — `@import 'tailwindcss'` only
- **NO .eslintrc files** — ESLint 9 flat config only
- **NO adding dependencies without checking versions** — `npm view <pkg> version` first
- **NO publishing with `--dry-run` when actual publish is needed** — Use `--access public` for real publish
- **NO changing the npm package name** — It is `@appydave/appystack-config`, owned by klueless-io on npmjs.com

## Work Units

Each work unit has three fields:
- **What**: The specific changes to make
- **Why**: The problem this solves
- **Done when**: Verifiable completion criteria checked before reporting back
