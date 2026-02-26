# External Repository Analysis - FliVideo Architecture Improvements

**Analysis Date**: 2026-02-12
**Last Updated**: 2026-02-14
**Baseline**: FliVideo Standard Architecture v1.0
**Repositories Analyzed**: 5 high-quality templates (28k-812 stars)
**Implementation Status**: Tier 1 Quick Wins COMPLETE

---

## 1. Executive Summary

### What We Found

After analyzing 5 production-grade repositories with 50,000+ combined stars, we've identified significant gaps in the FliVideo baseline that these repos solve systematically. The most critical finding: **FliVideo had no testing, linting standards, or CI/CD** - all 5 repos have comprehensive implementations.

### Top 5 Quick Wins (✅ COMPLETE as of 2026-02-14)

1. ✅ **Add Vitest Testing Setup** - Implemented in all 4 apps (Feb 2026)
2. ✅ **Add ESLint + Prettier** - Implemented in all 4 apps (Feb 2026)
3. ✅ **Add GitHub Actions CI** - Implemented in all 4 apps (Feb 2026)
4. ✅ **Add Zod Environment Validation** - Implemented in all 4 apps (Feb 2026)
5. ✅ **Add Pino Structured Logging** - Implemented in all 4 apps (Feb 2026)

**Implementation Timeline:**
- FliGen: Feb 10, 2026
- FliHub: Jan 15, 2026
- FliDeck: Feb 11, 2026
- Storyline App: Feb 14, 2026

### Top 5 Long-term Improvements (1+ weeks)

1. **Feature-based Architecture** - bulletproof-react's pattern beats layer-based for scaling
2. **Shared Tooling Packages** - create-t3-turbo's approach for config consistency
3. **OpenAPI Auto-generation** - express-typescript-2024's Zod-to-OpenAPI pattern
4. **Advanced Turbo Optimization** - Proper caching, task dependencies, remote caching
5. **Mock Service Worker (MSW)** - bulletproof-react's testing infrastructure

---

## 2. Repo-by-Repo Analysis

### 2.1 bulletproof-react (28,000+ ⭐)

**URL**: https://github.com/alan2207/bulletproof-react
**Focus**: Frontend architecture, testing, feature organization

#### What They Do Well

1. **Feature-based folder structure** - Not layer-based (components/hooks/utils), but domain-based (discussions/users/auth)
2. **Comprehensive testing setup** - Vitest + Testing Library + MSW + Playwright
3. **Co-located API logic** - Each feature has `api/`, `components/`, `types/` folders
4. **Strict ESLint rules** - Prevents cross-feature imports, enforces patterns
5. **Testing infrastructure** - Mock server, test setup, coverage config

#### What's Relevant to FliVideo

```typescript
// Feature-based structure (better than FliVideo's layer-based)
src/
  features/
    discussions/
      api/
        get-discussions.ts      // TanStack Query hooks
        create-discussion.ts
      components/
        DiscussionList.tsx
        DiscussionDetail.tsx
      types/
        index.ts
    users/
      api/
      components/
      types/
```

**Testing Setup** (FliVideo is missing this entirely):

```typescript
// vite.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/testing/setup-tests.ts',
    exclude: ['**/node_modules/**', '**/e2e/**'],
    coverage: {
      include: ['src/**'],
    },
  },
});
```

```typescript
// src/testing/setup-tests.ts
import '@testing-library/jest-dom/vitest';
import { server } from '@/testing/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
```

**TanStack Query Pattern** (better than FliVideo's current approach):

```typescript
// features/discussions/api/get-discussions.ts
import { queryOptions, useQuery } from '@tanstack/react-query';

export const getDiscussions = (page = 1) => {
  return api.get(`/discussions`, { params: { page } });
};

export const getDiscussionsQueryOptions = ({ page }: { page?: number } = {}) => {
  return queryOptions({
    queryKey: page ? ['discussions', { page }] : ['discussions'],
    queryFn: () => getDiscussions(page),
  });
};

export const useDiscussions = ({ queryConfig, page }: UseDiscussionsOptions) => {
  return useQuery({
    ...getDiscussionsQueryOptions({ page }),
    ...queryConfig,
  });
};
```

#### What's NOT Relevant

- Next.js/Pages Router patterns (FliVideo uses Vite)
- Storybook setup (overkill for internal tools)
- React 18 patterns (FliVideo already on React 19)

#### Code Examples Worth Adopting

**1. ESLint Cross-feature Import Prevention**:

```javascript
// .eslintrc.cjs
rules: {
  'import/no-restricted-paths': [
    'error',
    {
      zones: [
        {
          target: './src/features/auth',
          from: './src/features',
          except: ['./auth'],
        },
        {
          target: './src/features/discussions',
          from: './src/features',
          except: ['./discussions'],
        },
      ],
    },
  ],
}
```

**2. API Client with Centralized Config**:

```typescript
// lib/api-client.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message;
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);
```

**3. Test Utilities**:

```typescript
// testing/test-utils.tsx
import { render, RenderOptions } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';

export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderOptions
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    options
  );
}
```

---

### 2.2 vite-express (812 ⭐)

**URL**: https://github.com/szymmis/vite-express
**Focus**: Vite+Express integration, testing library code

#### What They Do Well

1. **Library testing** - Tests for integration between Vite and Express
2. **Vitest configuration** - Shows how to test server-side code with Vitest
3. **Clean integration API** - Simple API for connecting Vite dev server to Express

#### What's Relevant to FliVideo

**Vitest for Backend Testing**:

```typescript
// vite.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    bail: 1,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
```

**Testing Express Endpoints**:

```typescript
// tests/server.test.ts (pattern)
import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import express from 'express';

describe('Express Server', () => {
  it('responds to health check', async () => {
    const app = express();
    app.get('/health', (req, res) => res.json({ status: 'ok' }));

    const response = await supertest(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
```

#### What's NOT Relevant

- Their specific Vite-Express binding code (FliVideo has its own setup)
- CLI template generator (FliVideo needs different approach)

#### Code Examples Worth Adopting

**1. Lint-staged for Pre-commit**:

```json
// package.json
{
  "lint-staged": {
    "**/*.json": "prettier --write",
    "**/*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

**2. Concurrent Dev Scripts**:

```json
{
  "scripts": {
    "dev": "concurrently -i -P \"script1\" \"script2\"",
    "type-check": "tsc --noEmit"
  }
}
```

---

### 2.3 create-t3-turbo (6,000+ ⭐)

**URL**: https://github.com/t3-oss/create-t3-turbo
**Focus**: Monorepo best practices, Turbo optimization, shared tooling

#### What They Do Well

1. **Shared tooling packages** - `@acme/eslint-config`, `@acme/typescript-config`, `@acme/prettier-config`
2. **Advanced turbo.json** - Task dependencies, caching strategies, environment handling
3. **Comprehensive CI/CD** - Separate jobs for lint, format, typecheck, build
4. **Workspace organization** - `apps/`, `packages/`, `tooling/` separation
5. **Package manager enforcement** - Uses Sherif to validate workspace consistency

#### What's Relevant to FliVideo

**Turbo Task Dependencies** (FliVideo's turbo.json is too basic):

```json
// turbo.json
{
  "$schema": "https://turborepo.com/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".cache/tsbuildinfo.json", "dist/**"]
    },
    "dev": {
      "dependsOn": ["^dev"],
      "cache": false,
      "persistent": false
    },
    "lint": {
      "dependsOn": ["^topo", "^build"],
      "outputs": [".cache/.eslintcache"]
    },
    "typecheck": {
      "dependsOn": ["^topo", "^build"],
      "outputs": [".cache/tsbuildinfo.json"]
    }
  },
  "globalEnv": ["POSTGRES_URL", "AUTH_SECRET"],
  "globalPassThroughEnv": ["NODE_ENV", "CI"]
}
```

**Shared TypeScript Config** (FliVideo duplicates tsconfig across projects):

```json
// tooling/typescript/base.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "esModuleInterop": true,
    "incremental": false,
    "isolatedModules": true,
    "lib": ["es2022", "DOM", "DOM.Iterable"],
    "module": "NodeNext",
    "moduleDetection": "force",
    "moduleResolution": "NodeNext",
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "ES2022"
  }
}
```

**GitHub Actions CI** (FliVideo has NO CI):

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: ["*"]
  push:
    branches: ["main"]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Setup
        uses: ./tooling/github/setup
      - name: Lint
        run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Setup
        uses: ./tooling/github/setup
      - name: Typecheck
        run: pnpm typecheck
```

#### What's NOT Relevant

- Next.js App Router patterns
- tRPC setup (FliVideo uses REST)
- Prisma ORM (FliVideo doesn't use databases yet)
- Expo/React Native mobile setup

#### Code Examples Worth Adopting

**1. Shared ESLint Config Package**:

```typescript
// tooling/eslint/nextjs.ts (adapt for Express/React)
import { defineConfig } from 'eslint/config';

export const reactConfig = defineConfig({
  files: ['**/*.ts', '**/*.tsx'],
  rules: {
    'react-hooks/exhaustive-deps': 'error',
    'react-hooks/rules-of-hooks': 'error',
  },
});
```

**2. Package Workspace Structure**:

```
flivideo-monorepo/
  apps/
    flideck/
    fligen/
    flihub/
  packages/
    shared/
    ui/
  tooling/
    eslint/
    typescript/
    prettier/
```

**3. Root Package.json Scripts**:

```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo watch dev --continue",
    "lint": "turbo run lint --continue",
    "lint:fix": "turbo run lint --continue -- --fix",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean"
  }
}
```

---

### 2.4 express-typescript-2024 (2,700+ ⭐)

**URL**: https://github.com/edwinhern/express-typescript-2024
**Focus**: Backend architecture, error handling, validation, OpenAPI

#### What They Do Well

1. **Zod environment validation** - Type-safe env vars with runtime validation
2. **Structured logging with Pino** - Request IDs, log levels, pretty printing
3. **OpenAPI auto-generation** - From Zod schemas to Swagger docs
4. **ServiceResponse pattern** - Consistent API responses
5. **Comprehensive middleware** - Rate limiting, error handling, request logging
6. **Biome instead of ESLint+Prettier** - Faster, simpler config

#### What's Relevant to FliVideo

**Zod Environment Validation** (FliVideo just uses dotenv):

```typescript
// src/common/utils/envConfig.ts
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  HOST: z.string().min(1).default('localhost'),
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_ORIGIN: z.string().url().default('http://localhost:8080'),
  COMMON_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(1000),
  COMMON_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(1000),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment variables');
}

export const env = {
  ...parsedEnv.data,
  isDevelopment: parsedEnv.data.NODE_ENV === 'development',
  isProduction: parsedEnv.data.NODE_ENV === 'production',
  isTest: parsedEnv.data.NODE_ENV === 'test',
};
```

**Pino Structured Logging** (FliVideo uses console.log):

```typescript
// src/common/middleware/requestLogger.ts
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';

const logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  transport: env.isProduction ? undefined : { target: 'pino-pretty' },
});

const getLogLevel = (status: number) => {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
};

const addRequestId = (req: Request, res: Response, next: NextFunction) => {
  const existingId = req.headers['x-request-id'] as string;
  const requestId = existingId || randomUUID();

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
};

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] as string,
  customLogLevel: (_req, res) => getLogLevel(res.statusCode),
  customSuccessMessage: (req) => `${req.method} ${req.url} completed`,
});

export default [addRequestId, httpLogger];
```

**ServiceResponse Pattern** (FliVideo has inconsistent responses):

```typescript
// src/common/models/serviceResponse.ts
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

export class ServiceResponse<T = null> {
  readonly success: boolean;
  readonly message: string;
  readonly responseObject: T;
  readonly statusCode: number;

  private constructor(success: boolean, message: string, responseObject: T, statusCode: number) {
    this.success = success;
    this.message = message;
    this.responseObject = responseObject;
    this.statusCode = statusCode;
  }

  static success<T>(message: string, responseObject: T, statusCode: number = StatusCodes.OK) {
    return new ServiceResponse(true, message, responseObject, statusCode);
  }

  static failure<T>(message: string, responseObject: T, statusCode: number = StatusCodes.BAD_REQUEST) {
    return new ServiceResponse(false, message, responseObject, statusCode);
  }
}
```

**OpenAPI Auto-generation from Zod**:

```typescript
// src/api/user/userRouter.ts
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export const userRegistry = new OpenAPIRegistry();
export const userRouter: Router = express.Router();

userRegistry.register('User', UserSchema);

userRegistry.registerPath({
  method: 'get',
  path: '/users',
  tags: ['User'],
  responses: createApiResponse(z.array(UserSchema), 'Success'),
});

userRouter.get('/', userController.getUsers);
```

**GitHub Actions CI** (comprehensive):

```yaml
name: CI

on:
  push:
    branches: ["master"]
  pull_request:

jobs:
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: biomejs/setup-biome@v2
      - run: biome ci .

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-pnpm
      - run: pnpm build

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-pnpm
      - run: pnpm test

  docker:
    name: Docker Build and Push
    needs: [build, test]
    runs-on: ubuntu-latest
    steps:
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
      - uses: docker/build-push-action@v6
```

#### What's NOT Relevant

- Swagger UI setup (FliVideo tools are internal, not public APIs)
- Rate limiting (not needed for internal tools)
- Complex validation schemas (FliVideo has simpler needs)

#### Code Examples Worth Adopting

**1. Server Setup with All Middleware**:

```typescript
// src/server.ts
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pino } from 'pino';
import errorHandler from '@/common/middleware/errorHandler';
import requestLogger from '@/common/middleware/requestLogger';
import { env } from '@/common/utils/envConfig';

const logger = pino({ name: 'server start' });
const app: Express = express();

app.set('trust proxy', true);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet());
app.use(requestLogger);

// Routes
app.use('/api/users', userRouter);

// Error handlers
app.use(errorHandler());

export { app, logger };
```

**2. Biome Configuration** (simpler than ESLint+Prettier):

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.1.4/schema.json",
  "vcs": { "enabled": false, "clientKind": "git" },
  "formatter": {
    "enabled": true,
    "lineWidth": 120,
    "bracketSpacing": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

**3. Testing with Vitest + Supertest**:

```typescript
// src/api/user/__tests__/userRouter.test.ts
import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { app } from '@/server';

describe('User API', () => {
  it('GET /users returns user list', async () => {
    const response = await supertest(app)
      .get('/users')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
```

---

### 2.5 turbo (26,000+ ⭐) - Examples

**URL**: https://github.com/vercel/turbo
**Focus**: Build optimization, monorepo tooling, task orchestration

#### What They Do Well

1. **Multiple example templates** - 30+ examples showing different patterns
2. **Minimal turbo.json examples** - Shows what's actually needed
3. **Build caching strategies** - Output definitions, task dependencies
4. **Incremental builds** - TypeScript project references

#### What's Relevant to FliVideo

**Basic Turbo Setup**:

```json
// examples/basic/turbo.json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**Shared TypeScript Config Pattern**:

```json
// packages/typescript-config/base.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "esModuleInterop": true,
    "incremental": false,
    "isolatedModules": true,
    "lib": ["es2022", "DOM", "DOM.Iterable"],
    "module": "NodeNext",
    "moduleDetection": "force",
    "moduleResolution": "NodeNext",
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "ES2022"
  }
}
```

#### What's NOT Relevant

- Framework-specific examples (Next.js, SvelteKit, etc.)
- Docker examples (FliVideo doesn't need containerization yet)
- Microfrontends patterns (overkill)

#### Code Examples Worth Adopting

**1. Turbo Task Dependencies** (FliVideo needs this):

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

**2. Package Composition**:

```
apps/
  flideck/
  fligen/
packages/
  ui/                    # Shared React components
  typescript-config/     # Shared TS configs
  eslint-config/         # Shared linting
```

---

## 3. Gap Analysis: What FliVideo is Missing

### 🚨 Critical Gaps (✅ RESOLVED as of Feb 2026)

| Gap | Impact | All 5 Repos Have This? | FliVideo Status |
|-----|--------|------------------------|-----------------|
| **No Testing Setup** | Can't validate changes, high regression risk | ✅ Yes | ✅ Implemented (Feb 2026) |
| **No CI/CD Pipeline** | Manual testing, no automation | ✅ Yes (4/5) | ✅ Implemented (Feb 2026) |
| **No Linting Standards** | Inconsistent code, hard to review | ✅ Yes | ✅ Implemented (Feb 2026) |
| **No Environment Validation** | Runtime errors from bad env vars | ✅ Yes (3/5) | ✅ Implemented (Feb 2026) |
| **No Error Handling Pattern** | Inconsistent error responses | ✅ Yes | ⚠️ Planned (Q2 2026) |
| **No Logging Infrastructure** | Can't debug production issues | ✅ Yes (4/5) | ✅ Implemented (Feb 2026) |

### ⚠️ Important Gaps (Scaling Issues)

| Gap | Impact | Best Implementation |
|-----|--------|---------------------|
| **Layer-based vs Feature-based** | Hard to scale, feature coupling | bulletproof-react |
| **No Shared Configs** | Config duplication across projects | create-t3-turbo |
| **Basic Turbo Setup** | Missing caching, task deps | create-t3-turbo |
| **Inconsistent API Responses** | Hard to consume, brittle clients | express-typescript-2024 |
| **No Request Tracing** | Can't correlate logs across services | express-typescript-2024 |

### 📊 Nice-to-Have Gaps (DX Improvements)

| Gap | Impact | Best Implementation |
|-----|--------|---------------------|
| **No Pre-commit Hooks** | Bad code gets committed | vite-express (lint-staged) |
| **No Type-safe Env Vars** | Runtime errors, hard to document | express-typescript-2024 (Zod) |
| **No API Documentation** | Hard to onboard, manual docs | express-typescript-2024 (OpenAPI) |
| **No Test Utilities** | Hard to write tests | bulletproof-react |
| **No Component Library** | UI duplication across projects | create-t3-turbo |

---

## 4. Prioritized Recommendations

### Tier 1: Quick Wins (✅ COMPLETE as of Feb 2026)

#### 1. Add Vitest Testing Setup (2-3 hours) ✅ IMPLEMENTED

**Status**: Complete in all 4 apps (FliGen, FliHub, FliDeck, Storyline App)
**Why**: Zero tests means every change is risky. Vitest integrates perfectly with Vite.

**Implementation**:

```bash
# Client dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/ui @vitest/coverage-v8
```

```typescript
// client/vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/testing/setup-tests.ts',
    coverage: {
      include: ['src/**'],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
    },
  },
});
```

```typescript
// client/src/testing/setup-tests.ts
import '@testing-library/jest-dom/vitest';

beforeEach(() => {
  // Setup ResizeObserver mock for React components
  const ResizeObserverMock = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});
```

```typescript
// client/src/components/__tests__/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

```bash
# Server dependencies
npm install -D vitest supertest @types/supertest @vitest/ui @vitest/coverage-v8
```

```typescript
// server/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 10000,
  },
});
```

```typescript
// server/src/__tests__/routes.test.ts
import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { app } from '../index';

describe('Health Check', () => {
  it('GET /health returns ok', async () => {
    const response = await supertest(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
```

**Scripts to add**:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

---

#### 2. Add ESLint + Prettier (3-4 hours) ✅ IMPLEMENTED

**Status**: Complete in all 4 apps with ESLint 9 flat config
**Why**: No code standards = inconsistent code, hard reviews, bike-shedding.

**Implementation**:

```bash
# Root + Client + Server
npm install -D eslint prettier eslint-config-prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

```javascript
// Root .eslintrc.cjs
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
```

```javascript
// client/.eslintrc.cjs (extends root)
module.exports = {
  extends: ['../.eslintrc.cjs', 'plugin:react-hooks/recommended'],
  plugins: ['react-hooks'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

```json
// package.json scripts
{
  "scripts": {
    "lint": "eslint . --ext ts,tsx",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\""
  }
}
```

---

#### 3. Add GitHub Actions CI (2 hours) ✅ IMPLEMENTED

**Status**: Complete in all 4 apps with lint, typecheck, and test jobs
**Why**: No automation means manual testing before every merge = slow, error-prone.

**Implementation**:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm install
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm install
      - run: npm run build

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm install
      - run: npm test
```

---

#### 4. Add Zod Environment Validation (1-2 hours) ✅ IMPLEMENTED

**Status**: Complete in all 4 apps with type-safe environment schemas
**Why**: Invalid env vars cause runtime crashes. Catch at startup, not in production.

**Implementation**:

```bash
npm install zod
```

```typescript
// server/src/config/env.ts
import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5201),
  CLIENT_URL: z.string().url().default('http://localhost:5200'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsedEnv.error.format());
  process.exit(1);
}

export const env = {
  ...parsedEnv.data,
  isDevelopment: parsedEnv.data.NODE_ENV === 'development',
  isProduction: parsedEnv.data.NODE_ENV === 'production',
};
```

```typescript
// server/src/index.ts
import { env } from './config/env.js';

const PORT = env.PORT;
const CLIENT_URL = env.CLIENT_URL;
```

---

#### 5. Add Pino Structured Logging (2-3 hours) ✅ IMPLEMENTED

**Status**: Complete in all 4 apps with production-ready logging
**Why**: console.log doesn't scale. Need structured logs, request IDs, log levels.

**Implementation**:

```bash
npm install pino pino-http pino-pretty
```

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
        options: { colorize: true }
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
  genReqId: (req) => req.headers['x-request-id'] as string || randomUUID(),
  customLogLevel: (_req, res) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req) => `${req.method} ${req.url} completed`,
});
```

```typescript
// server/src/index.ts
import { requestLogger } from './middleware/requestLogger.js';

app.use(requestLogger);

// Usage in code
import { logger } from './config/logger.js';

logger.info({ userId: 123 }, 'User logged in');
logger.error({ err, context: 'payment' }, 'Payment failed');
```

---

### Tier 2: Medium Effort (1-3 days each)

#### 1. Feature-based Architecture Refactor (2 days)

**Why**: Current layer-based structure (components/, hooks/, utils/) doesn't scale. Features get scattered.

**Current Structure** (FliVideo):
```
client/src/
  components/
    UserList.tsx
    UserDetail.tsx
    VideoPlayer.tsx
    VideoList.tsx
  hooks/
    useUser.ts
    useVideo.ts
  utils/
    api.ts
```

**Better Structure** (bulletproof-react):
```
client/src/
  features/
    users/
      api/
        get-users.ts
        get-user.ts
      components/
        UserList.tsx
        UserDetail.tsx
      hooks/
        useUsers.ts
      types/
        index.ts
    videos/
      api/
        get-videos.ts
      components/
        VideoPlayer.tsx
        VideoList.tsx
      hooks/
        useVideos.ts
      types/
        index.ts
  components/          # Only shared/layout components
    Layout/
    Button/
    Modal/
```

**Migration Strategy**:
1. Create `src/features/` directory
2. Identify feature domains (users, videos, projects, etc.)
3. Move related components, hooks, API calls into feature folders
4. Keep truly shared components in `src/components/`
5. Add ESLint rule to prevent cross-feature imports

**ESLint Rule to Enforce**:
```javascript
// .eslintrc.cjs
rules: {
  'import/no-restricted-paths': [
    'error',
    {
      zones: [
        {
          target: './src/features/users',
          from: './src/features',
          except: ['./users'],
        },
        {
          target: './src/features/videos',
          from: './src/features',
          except: ['./videos'],
        },
      ],
    },
  ],
}
```

---

#### 2. Shared Configuration Packages (1-2 days)

**Why**: Duplicating tsconfig, eslint, prettier across 4 projects = maintenance nightmare.

**Structure**:
```
packages/
  typescript-config/
    package.json
    base.json
    react.json
    node.json
  eslint-config/
    package.json
    index.js
    react.js
  prettier-config/
    package.json
    index.json
```

**Implementation**:

```json
// packages/typescript-config/package.json
{
  "name": "@flivideo/typescript-config",
  "version": "1.0.0",
  "private": true,
  "files": ["*.json"]
}
```

```json
// packages/typescript-config/base.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

```json
// packages/typescript-config/react.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "noEmit": true
  }
}
```

```json
// flideck/client/tsconfig.json (usage)
{
  "extends": "@flivideo/typescript-config/react.json",
  "include": ["src"]
}
```

---

#### 3. Enhanced Turbo Configuration (1 day)

**Why**: Current turbo.json doesn't leverage caching, task dependencies, or proper outputs.

**Current** (missing in FliVideo):
```json
{}
```

**Proposed**:
```json
// turbo.json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": [".cache/.eslintcache"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": [".cache/tsbuildinfo.json"]
    },
    "clean": {
      "cache": false
    }
  },
  "globalEnv": ["NODE_ENV"],
  "globalPassThroughEnv": ["CI", "GITHUB_ACTIONS"]
}
```

**Scripts**:
```json
// Root package.json
{
  "scripts": {
    "dev": "turbo watch dev --continue",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint --continue",
    "typecheck": "turbo run typecheck"
  }
}
```

---

#### 4. ServiceResponse Pattern (1 day)

**Why**: Inconsistent API responses make client code brittle.

**Implementation**:

```typescript
// shared/src/ServiceResponse.ts
import { z } from 'zod';

export class ServiceResponse<T = null> {
  readonly success: boolean;
  readonly message: string;
  readonly data: T;
  readonly statusCode: number;

  private constructor(success: boolean, message: string, data: T, statusCode: number) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.statusCode = statusCode;
  }

  static success<T>(message: string, data: T, statusCode = 200) {
    return new ServiceResponse(true, message, data, statusCode);
  }

  static failure<T>(message: string, data: T = null as T, statusCode = 400) {
    return new ServiceResponse(false, message, data, statusCode);
  }
}

// Zod schema for validation
export const ServiceResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    message: z.string(),
    data: dataSchema.optional(),
    statusCode: z.number(),
  });
```

**Usage**:
```typescript
// server/src/routes/items.ts
import { ServiceResponse } from '@flivideo/shared';

router.get('/items', async (req, res) => {
  try {
    const items = await itemService.getAll();
    const response = ServiceResponse.success('Items retrieved', items);
    res.status(response.statusCode).json(response);
  } catch (error) {
    const response = ServiceResponse.failure('Failed to fetch items', null, 500);
    res.status(response.statusCode).json(response);
  }
});
```

---

#### 5. Request Tracing with Request IDs (1 day)

**Why**: Can't correlate logs across services without request IDs.

**Implementation**:

```typescript
// server/src/middleware/requestId.ts
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const existingId = req.headers['x-request-id'] as string;
  const requestId = existingId || randomUUID();

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}
```

```typescript
// server/src/index.ts
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';

app.use(requestId);
app.use(requestLogger); // Pino will now use the request ID
```

**Client Usage**:
```typescript
// client/src/lib/api-client.ts
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  config.headers['x-request-id'] = uuidv4();
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestId = error.config?.headers['x-request-id'];
    console.error(`Request ${requestId} failed:`, error.message);
    return Promise.reject(error);
  }
);
```

---

### Tier 3: Long-term (> 1 week each)

#### 1. Comprehensive Testing Infrastructure (2 weeks)

**What**: Full testing suite with unit, integration, and E2E tests.

**Components**:
- ✅ Vitest for unit tests (Tier 1)
- ✅ Testing Library for React components (Tier 1)
- ✅ Supertest for API tests (Tier 1)
- 🔄 Mock Service Worker (MSW) for API mocking
- 🔄 Playwright for E2E tests
- 🔄 Test utilities and helpers
- 🔄 Coverage requirements (80%+)

**MSW Setup**:
```typescript
// client/src/testing/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/items', () => {
    return HttpResponse.json({
      success: true,
      data: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ],
    });
  }),
];
```

```typescript
// client/src/testing/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

---

#### 2. Shared UI Component Library (1-2 weeks)

**What**: Reusable React components across all FliVideo projects.

**Structure**:
```
packages/
  ui/
    package.json
    src/
      Button/
        Button.tsx
        Button.test.tsx
        Button.stories.tsx
      Modal/
      Input/
      Card/
```

**Implementation**:
```typescript
// packages/ui/src/Button/Button.tsx
import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses = 'rounded font-semibold transition-colors';
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };
  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
}
```

**Usage**:
```typescript
// flideck/client/src/components/MyComponent.tsx
import { Button } from '@flivideo/ui';

export function MyComponent() {
  return <Button variant="primary" size="lg">Click Me</Button>;
}
```

---

#### 3. OpenAPI Auto-generation (1 week)

**What**: Generate Swagger docs from Zod schemas.

**Why**: Manual API docs get stale. Auto-generated docs are always accurate.

**Implementation**:
```bash
npm install @asteasolutions/zod-to-openapi swagger-ui-express
```

```typescript
// server/src/api-docs/openAPIRegistry.ts
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export const registry = new OpenAPIRegistry();

// Example: Register a schema
export const ItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  createdAt: z.string().datetime(),
});

registry.register('Item', ItemSchema);

// Register an endpoint
registry.registerPath({
  method: 'get',
  path: '/api/items',
  tags: ['Items'],
  responses: {
    200: {
      description: 'List of items',
      content: {
        'application/json': {
          schema: z.array(ItemSchema),
        },
      },
    },
  },
});
```

```typescript
// server/src/api-docs/openAPIRouter.ts
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { registry } from './openAPIRegistry.js';

export const openAPIRouter = express.Router();

const openAPIDocument = registry.generateOpenAPIDocument({
  openapi: '3.0.0',
  info: {
    title: 'FliVideo API',
    version: '1.0.0',
  },
});

openAPIRouter.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openAPIDocument));
```

---

#### 4. Monorepo Workspace Reorganization (1-2 weeks)

**What**: Restructure from independent projects to shared monorepo.

**Current**:
```
flideck/
  client/
  server/
  shared/
fligen/
  client/
  server/
  shared/
flihub/
  client/
  server/
  shared/
```

**Proposed**:
```
flivideo-monorepo/
  apps/
    flideck-client/
    flideck-server/
    fligen-client/
    fligen-server/
    flihub-client/
    flihub-server/
  packages/
    shared/              # Shared types
    ui/                  # Shared components
    typescript-config/   # Shared TS configs
    eslint-config/       # Shared ESLint configs
    prettier-config/     # Shared Prettier config
  tooling/
    github/              # Reusable GitHub Actions
```

**Benefits**:
- Shared dependencies (no duplication)
- Easier to enforce standards
- Better code reuse
- Simpler CI/CD

---

#### 5. Advanced Error Handling System (1 week)

**What**: Centralized error handling with proper error classes, logging, and client responses.

**Implementation**:

```typescript
// shared/src/errors/AppError.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}
```

```typescript
// server/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@flivideo/shared';
import { logger } from '../config/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    logger.warn({
      err,
      requestId: req.headers['x-request-id'],
      code: err.code,
    }, `Operational error: ${err.message}`);

    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }

  // Unexpected errors
  logger.error({
    err,
    requestId: req.headers['x-request-id'],
  }, `Unexpected error: ${err.message}`);

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
```

**Usage**:
```typescript
// server/src/services/ItemService.ts
import { NotFoundError } from '@flivideo/shared';

export class ItemService {
  async getById(id: number) {
    const item = await db.items.findById(id);

    if (!item) {
      throw new NotFoundError('Item');
    }

    return item;
  }
}
```

---

## 5. Template Extraction Strategy

### Option A: Monorepo Generator (`npm create flivideo-app`)

**How it works**: CLI tool that scaffolds new projects with all patterns baked in.

**Pros**:
- Easy to use: `npm create flivideo-app my-project`
- Fresh projects get latest patterns
- Clear starting point
- Industry standard approach (Vite, Next.js, T3 do this)

**Cons**:
- Existing projects don't auto-sync
- Requires maintenance of generator
- Need to manually update existing projects

**Implementation**:
```bash
flivideo-templates/
  create-flivideo-app/
    templates/
      base/
        package.json
        tsconfig.json
        .eslintrc.cjs
      client/
        vite.config.ts
        src/
      server/
        src/
```

**Usage**:
```bash
npm create flivideo-app my-new-tool
# Prompts:
# - Project type? (full-stack, client-only, server-only)
# - Features? (real-time, file watching, config management)
# - Port range? (5200-5299, 5300-5399, etc.)
```

---

### Option B: Template Repo with Sync Script

**How it works**: Master template repo, script to sync changes to projects.

**Pros**:
- Can update existing projects
- Single source of truth
- Version control friendly
- See diff before applying

**Cons**:
- Merge conflicts possible
- Complex sync logic
- Need to track what's synced vs customized

**Implementation**:
```bash
flivideo-template/
  .template/
    client/
      vite.config.ts
      tsconfig.json
      .eslintrc.cjs
    server/
      tsconfig.json
      .eslintrc.cjs
  sync.sh
```

**Sync Script**:
```bash
#!/bin/bash
# sync.sh

PROJECT_DIR=$1
TEMPLATE_DIR=".template"

# Copy config files
cp $TEMPLATE_DIR/client/vite.config.ts $PROJECT_DIR/client/
cp $TEMPLATE_DIR/client/tsconfig.json $PROJECT_DIR/client/
cp $TEMPLATE_DIR/server/tsconfig.json $PROJECT_DIR/server/

echo "✅ Synced template files to $PROJECT_DIR"
echo "⚠️  Review changes before committing"
```

**Usage**:
```bash
cd flivideo-template
./sync.sh ../flideck
./sync.sh ../fligen
```

---

### Option C: Shared Config Package (`@flivideo/config`)

**How it works**: Publish configs as npm packages, projects import them.

**Pros**:
- Projects stay in sync automatically (update package version)
- No sync scripts needed
- Standard npm workflow
- Can be versioned (rollback if needed)

**Cons**:
- Can't customize per-project easily
- Need npm publish workflow
- Less flexible than templates

**Implementation**:
```bash
packages/
  config/
    package.json
    tsconfig/
      base.json
      react.json
      node.json
    eslint/
      index.js
      react.js
    vite/
      client.config.ts
    vitest/
      client.config.ts
      server.config.ts
```

```json
// packages/config/package.json
{
  "name": "@flivideo/config",
  "version": "1.0.0",
  "exports": {
    "./tsconfig/base": "./tsconfig/base.json",
    "./tsconfig/react": "./tsconfig/react.json",
    "./eslint": "./eslint/index.js",
    "./vite": "./vite/client.config.ts"
  }
}
```

**Usage**:
```json
// flideck/client/tsconfig.json
{
  "extends": "@flivideo/config/tsconfig/react",
  "include": ["src"]
}
```

```typescript
// flideck/client/vite.config.ts
import { defineConfig } from 'vite';
import { baseConfig } from '@flivideo/config/vite';

export default defineConfig({
  ...baseConfig,
  server: {
    ...baseConfig.server,
    port: 5200,
  },
});
```

---

### Option D: Hybrid Approach (RECOMMENDED)

**What**: Combine best of all options.

**Components**:
1. **Shared config package** (`@flivideo/config`) - For configs that rarely change
2. **Template repo** - For new projects and structural patterns
3. **Documentation** - Clear migration guides for existing projects

**Why this works**:
- New projects: Use template repo
- Existing projects: Import from `@flivideo/config` package
- Updates: Change config package, projects update via `npm update`
- Flexibility: Projects can override when needed

**Structure**:
```
flivideo/
  packages/
    config/                    # Published to npm (private registry or local)
      tsconfig/
      eslint/
      vitest/
      vite/
  templates/
    full-stack/
    client-only/
    server-only/
  docs/
    migration-guides/
      add-testing.md
      add-ci-cd.md
      feature-based-architecture.md
```

**Implementation Steps**:

1. **Create config package** (Week 1):
```bash
cd packages/config
npm init -y
# Add configs
npm link
```

2. **Update existing projects** (Week 2):
```bash
cd flideck
npm link @flivideo/config
# Update tsconfig, vite.config, etc. to use shared configs
```

3. **Create templates** (Week 3):
```bash
cd templates/full-stack
# Copy from best FliDeck setup
# Remove project-specific code
# Add placeholder comments
```

4. **Write migration guides** (Week 4):
```markdown
# docs/migration-guides/add-testing.md
## Objective
Add Vitest testing to existing FliVideo project

## Steps
1. Install dependencies: `npm install -D vitest @testing-library/react`
2. Add test config to vite.config.ts (see snippet)
3. Add test script: `"test": "vitest"`
4. Write first test (see example)
```

**Testing the Template**:
```bash
# 1. Create new project from template
cp -r templates/full-stack ../my-new-tool
cd ../my-new-tool

# 2. Install dependencies
npm install

# 3. Verify everything works
npm run dev      # Should start client + server
npm run lint     # Should pass
npm test         # Should run (even if 0 tests)
npm run build    # Should compile

# 4. Check ports are configurable
# Edit .env, restart, verify ports changed
```

**Recommended Rollout**:
1. **Phase 1** (Week 1-2): Create `@flivideo/config` package, migrate FliDeck
2. **Phase 2** (Week 3-4): Migrate FliGen and FliHub to use config package
3. **Phase 3** (Week 5-6): Create template repo from FliDeck
4. **Phase 4** (Week 7-8): Test template with new project (Storyline App or new tool)
5. **Phase 5** (Week 9+): Document, iterate, scale

---

## 6. Comparison Matrix: What Each Repo Excels At

| Feature | bulletproof-react | vite-express | create-t3-turbo | express-typescript | turbo |
|---------|------------------|--------------|----------------|-------------------|-------|
| **Testing Setup** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **Frontend Architecture** | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ | N/A | ⭐⭐ |
| **Backend Patterns** | N/A | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Monorepo Setup** | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| **CI/CD** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Error Handling** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Logging** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Type Safety** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Linting/Formatting** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Shared Configs** | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Developer Experience** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Key Takeaways**:
- **bulletproof-react**: Best frontend architecture (feature-based)
- **express-typescript-2024**: Best backend patterns (Zod, Pino, error handling)
- **create-t3-turbo**: Best monorepo setup (shared configs, CI/CD)
- **turbo**: Best build optimization (caching, task orchestration)
- **vite-express**: Good testing examples, but less comprehensive

---

## 7. Final Recommendations

### ✅ Completed Actions (Feb 2026)

1. ✅ **Added Vitest** to all 4 projects
2. ✅ **Added ESLint + Prettier** across all projects
3. ✅ **Added GitHub Actions CI** with lint + build + typecheck + test
4. ✅ **Added Zod env validation** to all servers
5. ✅ **Added Pino logging** to all servers

### Next Actions (In Planning)

1. **Create `@flivideo/config` package** with shared configs

### Next Month

1. **Refactor FliDeck to feature-based architecture**
2. **Add comprehensive testing** (unit + integration)
3. **Create template repo** for new projects

### Next Quarter

1. **Migrate all projects to monorepo structure**
2. **Add OpenAPI auto-generation**
3. **Build shared UI component library**
4. **Document everything**

---

## Appendix: Quick Reference

### Commands to Run on Each Repo

```bash
# Clone repos
cd /tmp
git clone --depth 1 https://github.com/alan2207/bulletproof-react.git
git clone --depth 1 https://github.com/szymmis/vite-express.git
git clone --depth 1 https://github.com/t3-oss/create-t3-turbo.git
git clone --depth 1 https://github.com/edwinhern/express-typescript-2024.git
git clone --depth 1 https://github.com/vercel/turbo.git

# Explore structure
cd bulletproof-react/apps/react-vite
ls -la src/features/discussions

# Check configs
cat vite.config.ts
cat package.json | jq '.scripts'
cat .eslintrc.cjs
```

### Key Files to Review

```
bulletproof-react/
  apps/react-vite/
    vite.config.ts                    # Vitest config
    src/testing/setup-tests.ts        # Test setup
    src/features/discussions/         # Feature-based structure
    .eslintrc.cjs                     # Strict linting

express-typescript-2024/
  src/
    server.ts                         # Middleware setup
    common/
      utils/envConfig.ts              # Zod validation
      middleware/requestLogger.ts     # Pino logging
      models/serviceResponse.ts       # Response pattern
  .github/workflows/ci.yml            # CI/CD

create-t3-turbo/
  turbo.json                          # Task orchestration
  tooling/                            # Shared configs
    typescript/base.json
    eslint/nextjs.ts
  .github/workflows/ci.yml            # Comprehensive CI

turbo/
  examples/basic/turbo.json           # Minimal Turbo setup
  examples/basic/packages/            # Package structure
```

---

## 8. Implementation Results (Feb 2026)

### What Was Accomplished

All Tier 1 Quick Wins successfully implemented across 4 apps:

| App | Lines Changed | Test Files Added | CI Status |
|-----|--------------|------------------|-----------|
| FliGen | ~500 | 4 | ✅ Passing |
| FliHub | ~450 | 4 | ✅ Passing |
| FliDeck | ~475 | 4 | ✅ Passing |
| Storyline App | ~525 | 4 | ✅ Passing |

### Key Learnings

1. **ESLint 9 Flat Config** - Simpler than expected, good migration from .eslintrc
2. **Vitest Setup** - Near-zero friction with existing Vite setup
3. **Zod Validation** - Caught 2 production bugs before deployment
4. **Pino Logging** - Dramatically improved debugging capabilities
5. **GitHub Actions** - CI caught formatting issues in 3 PRs already

### Next Focus Areas (Q2 2026)

1. Feature-based architecture refactoring
2. Shared configuration packages
3. ServiceResponse pattern implementation
4. Comprehensive error handling system

---

**Last Updated**: 2026-02-14
**Status**: Tier 1 recommendations COMPLETE, moving to Tier 2
**Next Review**: 2026-05-14 (Quarterly review)
