# FliVideo Apps - Quality Tooling Replication Brief

**Status**: ✅ COMPLETE - All apps now have quality tooling implemented
**Last Updated**: 2026-02-14

This document provided step-by-step requirements to replicate the FliGen quality tooling work across the 3 remaining FliVideo apps. **All work is now complete.**

## Implementation Summary

| App | Completion Date | Status |
|-----|----------------|--------|
| **FliGen** | 2026-02-10 | ✅ Reference implementation |
| **FliHub** | 2026-01-15 | ✅ Complete |
| **FliDeck** | 2026-02-11 | ✅ Complete |
| **Storyline App** | 2026-02-14 | ✅ Complete |

All apps now have:
- ESLint 9 with flat config
- Prettier formatting
- Vitest testing (client & server)
- GitHub Actions CI
- Zod environment validation
- Pino structured logging

---

## Original Documentation (For Reference)

## Reference: FliGen Completed Work

The following quality tooling was completed in FliGen and serves as the reference implementation:

1. **Vitest Testing Setup** - Client and server workspaces with test scripts
2. **ESLint 9 with Flat Config** - Root-level eslint.config.js with TypeScript and React support
3. **Prettier Formatting** - Consistent code formatting across all workspaces
4. **GitHub Actions CI Workflow** - Automated linting, formatting, type checking, and testing
5. **Zod Environment Validation** - Type-safe environment variable validation with schema
6. **Pino Structured Logging** - Production-ready logging with pretty-print for development

---

## App 1: FliHub

### Absolute Path
`/Users/davidcruwys/dev/ad/flivideo/flihub`

### Current Architecture
- **Workspace Structure**: npm workspaces (client, server, shared)
- **Client**: React 19 + Vite 6 + TailwindCSS v4 (port: Vite dev server)
- **Server**: Express 5 + Socket.io (port: 5101)
- **Shared**: TypeScript types
- **Key Dependencies**: @monaco-editor/react, @tanstack/react-query, sonner

### Port Numbers
- **Server**: 5101
- **Client**: Vite dev server (typically 5173, configurable)

### Current Tooling State (As of 2026-02-14: ✅ COMPLETE)
- ✅ TypeScript configured
- ✅ TailwindCSS v4
- ✅ ESLint 9 with flat config (Completed: 2026-01-15)
- ✅ Prettier configuration (Completed: 2026-01-15)
- ✅ Vitest testing setup (Completed: 2026-01-15)
- ✅ GitHub Actions CI (Completed: 2026-01-15)
- ✅ Zod environment validation (Completed: 2026-01-15)
- ✅ Pino structured logging (Completed: 2026-01-15)

### Replication Checklist

#### 1. ESLint 9 Setup

**Root package.json updates:**
```bash
npm install --save-dev eslint@^9.39.2 @eslint/js@^9.39.2 @typescript-eslint/eslint-plugin@^8.55.0 @typescript-eslint/parser@^8.55.0 eslint-config-prettier@^10.1.8 eslint-plugin-react@^7.37.5 eslint-plugin-react-hooks@^7.0.1 globals@^17.3.0
```

**Add scripts to root package.json:**
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

**Create eslint.config.js at root:**
```javascript
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  // Ignore patterns
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/coverage/**',
      '.worktrees/**',
      'server/scratch/**',
    ],
  },

  // Base config for all files
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
    },
  },

  // React-specific config for client files
  {
    files: ['client/**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
];
```

#### 2. Prettier Setup

**Install Prettier:**
```bash
npm install --save-dev prettier@^3.8.1
```

**Add scripts to root package.json:**
```json
{
  "scripts": {
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md}\""
  }
}
```

**Create .prettierrc at root:**
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always"
}
```

**Create .prettierignore at root:**
```
dist
build
node_modules
coverage
.worktrees
package-lock.json
```

#### 3. Vitest Testing Setup

**Install Vitest dependencies in client workspace:**
```bash
cd client
npm install --save-dev vitest@^4.0.18 @vitest/ui@^4.0.18 @vitest/coverage-v8@^4.0.18 @testing-library/react@^16.3.2 @testing-library/jest-dom@^6.9.1 @testing-library/user-event@^14.6.1 jsdom@^28.0.0
```

**Add scripts to client/package.json:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

**Create client/vitest.config.ts:**
```typescript
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

**Create client/src/test/setup.ts:**
```typescript
import '@testing-library/jest-dom';
```

**Install Vitest dependencies in server workspace:**
```bash
cd ../server
npm install --save-dev vitest@^4.0.18 @vitest/ui@^4.0.18 @vitest/coverage-v8@^4.0.18 @types/supertest@^6.0.3 supertest@^7.2.2
```

**Add scripts to server/package.json:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

**Create server/vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
```

**Add test scripts to root package.json:**
```json
{
  "scripts": {
    "test": "npm test -w client && npm test -w server",
    "test:client": "npm test -w client",
    "test:server": "npm test -w server",
    "test:ui": "npm run test:ui -w client",
    "test:coverage": "npm run test:coverage -w client && npm run test:coverage -w server"
  }
}
```

#### 4. Zod Environment Validation

**Install Zod in server workspace:**
```bash
cd server
npm install zod@^4.2.1
```

**Create server/src/config/env.ts:**
```typescript
import 'dotenv/config';
import { z } from 'zod';

// Environment schema with validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5101),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  // Add FliHub-specific environment variables here
  // Example:
  // WATCH_DIRECTORY: z.string().optional(),
  // PROJECT_DIRECTORY: z.string().optional(),
});

// Parse and validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  throw new Error('Invalid environment variables');
}

// Export validated environment with helper flags
export const env = {
  ...parsedEnv.data,
  isDevelopment: parsedEnv.data.NODE_ENV === 'development',
  isProduction: parsedEnv.data.NODE_ENV === 'production',
  isTest: parsedEnv.data.NODE_ENV === 'test',
};

// Type-safe environment variables
export type Env = typeof env;
```

**Update server/src/index.ts to use env:**
```typescript
import { env } from './config/env.js';

// Use env.PORT instead of process.env.PORT
app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
```

#### 5. Pino Structured Logging

**Install Pino in server workspace:**
```bash
cd server
npm install pino@^10.3.1 pino-pretty@^13.1.3 pino-http@^11.0.0
```

**Create server/src/config/logger.ts:**
```typescript
import pino from 'pino';
import { env } from './env.js';

// Create Pino logger instance
export const logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
});

// Type-safe logging helpers
export const log = {
  debug: (msg: string, obj?: object) => logger.debug(obj, msg),
  info: (msg: string, obj?: object) => logger.info(obj, msg),
  warn: (msg: string, obj?: object) => logger.warn(obj, msg),
  error: (msg: string, obj?: object | Error) => {
    if (obj instanceof Error) {
      logger.error({ err: obj }, msg);
    } else {
      logger.error(obj, msg);
    }
  },
  fatal: (msg: string, obj?: object | Error) => {
    if (obj instanceof Error) {
      logger.fatal({ err: obj }, msg);
    } else {
      logger.fatal(obj, msg);
    }
  },
};
```

**Update server code to use logger:**
```typescript
import { log } from './config/logger.js';

// Replace console.log with log.info, console.error with log.error, etc.
log.info('Server started', { port: env.PORT });
log.error('Something went wrong', error);
```

#### 6. GitHub Actions CI Workflow

**Create .github/workflows/ci.yml:**
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint code
        run: npm run lint

      - name: Check formatting
        run: npm run format:check

      - name: Type check
        run: npm run build

      - name: Run tests
        run: npm test
```

### App-Specific Considerations

1. **FliHub uses config.json** - The Zod schema should validate any file paths or configuration that comes from environment variables, not the config.json file itself
2. **WatcherManager and chokidar** - Consider adding logger calls to file watcher events for better observability
3. **Socket.io events** - Add logging for connection/disconnection events
4. **Recording naming validation** - The existing naming.ts in shared/ is perfect for unit testing with Vitest
5. **@monaco-editor/react** - May need special handling in Vitest tests; consider mocking if needed

### Verification Steps

1. Run `npm install` at root to ensure all dependencies are installed
2. Run `npm run lint` - should pass with no errors
3. Run `npm run format:check` - should pass with no errors
4. Run `npm run build` - should compile TypeScript successfully
5. Run `npm test` - should run (even if no tests exist yet, should not error)
6. Commit changes and verify GitHub Actions CI runs successfully

---

## App 2: Storyline App

### Absolute Path
`/Users/davidcruwys/dev/ad/flivideo/storyline-app`

### Current Architecture
- **Workspace Structure**: npm workspaces (client, server, shared)
- **Client**: React 19 + Vite 7 + TailwindCSS v4 (port: 5300)
- **Server**: Express 5 + Socket.io (port: 5301)
- **Shared**: TypeScript types
- **Key Dependencies**: Sharp, React Router, React Markdown, Chokidar
- **Note**: Client has basic ESLint 9 already configured

### Port Numbers
- **Server**: 5301
- **Client**: 5300

### Current Tooling State (As of 2026-02-14: ✅ COMPLETE)
- ✅ TypeScript configured
- ✅ TailwindCSS v4
- ✅ ESLint 9 with root-level flat config (Completed: 2026-02-14)
- ✅ Prettier configuration (Completed: 2026-02-14)
- ✅ Vitest testing setup (Completed: 2026-02-14)
- ✅ GitHub Actions CI (Completed: 2026-02-14)
- ✅ Zod environment validation (Completed: 2026-02-14)
- ✅ Pino structured logging (Completed: 2026-02-14)

### Replication Checklist

#### 1. ESLint 9 Root Configuration

**Root package.json updates:**
```bash
npm install --save-dev eslint@^9.39.2 @eslint/js@^9.39.2 @typescript-eslint/eslint-plugin@^8.55.0 @typescript-eslint/parser@^8.55.0 eslint-config-prettier@^10.1.8 globals@^17.3.0
```

**Note**: Client already has eslint-plugin-react-hooks and eslint-plugin-react-refresh, but we need react plugin for full coverage.

```bash
npm install --save-dev eslint-plugin-react@^7.37.5 eslint-plugin-react-hooks@^7.0.1
```

**Update root package.json scripts:**
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

**Create eslint.config.js at root** (same as FliHub - see FliHub section)

**Remove client/eslint.config.js** - Replaced by root configuration

#### 2. Prettier Setup

(Same as FliHub - see FliHub section)

#### 3. Vitest Testing Setup

**Install Vitest dependencies in client workspace:**
```bash
cd client
npm install --save-dev vitest@^4.0.18 @vitest/ui@^4.0.18 @vitest/coverage-v8@^4.0.18 @testing-library/react@^16.3.2 @testing-library/jest-dom@^6.9.1 @testing-library/user-event@^14.6.1 jsdom@^28.0.0
```

**Update client/package.json scripts** (replace placeholder):
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

**Create client/vitest.config.ts:**
```typescript
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

**Create client/src/test/setup.ts:**
```typescript
import '@testing-library/jest-dom';
```

**Install Vitest dependencies in server workspace:**
```bash
cd ../server
npm install --save-dev vitest@^4.0.18 @vitest/ui@^4.0.18 @vitest/coverage-v8@^4.0.18 @types/supertest@^6.0.3 supertest@^7.2.2
```

**Update server/package.json scripts:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

**Create server/vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
```

**Update root package.json scripts** (replace placeholders):
```json
{
  "scripts": {
    "test": "npm test -w client && npm test -w server",
    "test:client": "npm test -w client",
    "test:server": "npm test -w server",
    "test:ui": "npm run test:ui -w client",
    "test:coverage": "npm run test:coverage -w client && npm run test:coverage -w server"
  }
}
```

#### 4. Zod Environment Validation

**Install Zod in server workspace:**
```bash
cd server
npm install zod@^4.2.1
```

**Create server/src/config/env.ts:**
```typescript
import 'dotenv/config';
import { z } from 'zod';

// Environment schema with validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5301),
  CLIENT_URL: z.string().url().default('http://localhost:5300'),

  // Add Storyline App-specific environment variables here
  // Example:
  // PROJECTS_ROOT: z.string().optional(),
});

// Parse and validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  throw new Error('Invalid environment variables');
}

// Export validated environment with helper flags
export const env = {
  ...parsedEnv.data,
  isDevelopment: parsedEnv.data.NODE_ENV === 'development',
  isProduction: parsedEnv.data.NODE_ENV === 'production',
  isTest: parsedEnv.data.NODE_ENV === 'test',
};

// Type-safe environment variables
export type Env = typeof env;
```

**Update server/src/index.ts to use env:**
```typescript
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log(`Storyline Review Server running on port ${env.PORT}`);
});
```

#### 5. Pino Structured Logging

(Same setup as FliHub - see FliHub section)

**Server dependencies:**
```bash
cd server
npm install pino@^10.3.1 pino-pretty@^13.1.3 pino-http@^11.0.0
```

**Create server/src/config/logger.ts** (same as FliHub)

**Update server code to use logger** - Replace console.log/error with structured logging

#### 6. GitHub Actions CI Workflow

**Create .github/workflows/ci.yml** (same as FliHub - see FliHub section)

### App-Specific Considerations

1. **Multi-Project Support** - The app manages multiple external projects; consider adding logging for project switching and file system events
2. **Sharp Image Processing** - Add error logging for image processing failures
3. **Chokidar File Watchers** - Add debug logging for file system events (file added, changed, deleted)
4. **React Router** - Consider testing route configurations with Vitest
5. **Word-Level Timing Data** - The beat/segment schema is complex; excellent candidate for unit tests
6. **Schema Evolution** - Existing types.ts in shared/ should have validation tests for V0/V1/V2 schemas
7. **Existing Playwright** - Client already has Playwright installed; may want integration tests later

### Verification Steps

1. Run `npm install` at root
2. Run `npm run lint` - should pass
3. Run `npm run format:check` - should pass
4. Run `npm run build` - should compile successfully
5. Run `npm test` - should run without errors
6. Commit and verify GitHub Actions CI passes

---

## App 3: FliDeck

### Absolute Path
`/Users/davidcruwys/dev/ad/flivideo/flideck`

### Current Architecture
- **Workspace Structure**: npm workspaces (client, server, shared)
- **Client**: React 19 + Vite 6 + TailwindCSS v4 (port: 5200)
- **Server**: Express 5 + Socket.io (port: 5201)
- **Shared**: TypeScript types (uses scoped packages: @flideck/shared)
- **Key Dependencies**: React Router, Cheerio, fs-extra, AJV

### Port Numbers
- **Server**: 5201
- **Client**: 5200

### Current Tooling State (As of 2026-02-14: ✅ COMPLETE)
- ✅ TypeScript configured (with typecheck scripts)
- ✅ TailwindCSS v4
- ✅ ESLint 9 with flat config (Completed: 2026-02-11)
- ✅ Prettier configuration (Completed: 2026-02-11)
- ✅ Vitest testing setup (Completed: 2026-02-11)
- ✅ GitHub Actions CI (Completed: 2026-02-11)
- ✅ Zod environment validation (Completed: 2026-02-11)
- ✅ Pino structured logging (Completed: 2026-02-11)

### Replication Checklist

#### 1. ESLint 9 Setup

(Same as FliHub - see FliHub section)

**Root package.json updates:**
```bash
npm install --save-dev eslint@^9.39.2 @eslint/js@^9.39.2 @typescript-eslint/eslint-plugin@^8.55.0 @typescript-eslint/parser@^8.55.0 eslint-config-prettier@^10.1.8 eslint-plugin-react@^7.37.5 eslint-plugin-react-hooks@^7.0.1 globals@^17.3.0
```

**Add scripts to root package.json:**
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

**Create eslint.config.js at root** (same as FliHub)

#### 2. Prettier Setup

(Same as FliHub - see FliHub section)

#### 3. Vitest Testing Setup

**Install Vitest dependencies in client workspace:**
```bash
cd client
npm install --save-dev vitest@^4.0.18 @vitest/ui@^4.0.18 @vitest/coverage-v8@^4.0.18 @testing-library/react@^16.3.2 @testing-library/jest-dom@^6.9.1 @testing-library/user-event@^14.6.1 jsdom@^28.0.0
```

**Add scripts to client/package.json:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

**Create client/vitest.config.ts:**
```typescript
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

**Create client/src/test/setup.ts:**
```typescript
import '@testing-library/jest-dom';
```

**Install Vitest dependencies in server workspace:**
```bash
cd ../server
npm install --save-dev vitest@^4.0.18 @vitest/ui@^4.0.18 @vitest/coverage-v8@^4.0.18 @types/supertest@^6.0.3 supertest@^7.2.2
```

**Add scripts to server/package.json:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

**Create server/vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
```

**Add test scripts to root package.json:**
```json
{
  "scripts": {
    "test": "npm test -w client && npm test -w server",
    "test:client": "npm test -w client",
    "test:server": "npm test -w server",
    "test:ui": "npm run test:ui -w client",
    "test:coverage": "npm run test:coverage -w client && npm run test:coverage -w server"
  }
}
```

#### 4. Zod Environment Validation

**Install Zod in server workspace:**
```bash
cd server
npm install zod@^4.2.1
```

**Create server/src/config/env.ts:**
```typescript
import 'dotenv/config';
import { z } from 'zod';

// Environment schema with validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5201),
  CLIENT_URL: z.string().url().default('http://localhost:5200'),

  // Add FliDeck-specific environment variables here
  // Example:
  // PRESENTATIONS_ROOT: z.string().optional(),
});

// Parse and validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  throw new Error('Invalid environment variables');
}

// Export validated environment with helper flags
export const env = {
  ...parsedEnv.data,
  isDevelopment: parsedEnv.data.NODE_ENV === 'development',
  isProduction: parsedEnv.data.NODE_ENV === 'production',
  isTest: parsedEnv.data.NODE_ENV === 'test',
};

// Type-safe environment variables
export type Env = typeof env;
```

**Update server/src/index.ts to use env:**
```typescript
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log(`FliDeck server running on port ${env.PORT}`);
});
```

#### 5. Pino Structured Logging

(Same setup as FliHub - see FliHub section)

**Server dependencies:**
```bash
cd server
npm install pino@^10.3.1 pino-pretty@^13.1.3 pino-http@^11.0.0
```

**Create server/src/config/logger.ts** (same as FliHub)

**Update server code to use logger**

#### 6. GitHub Actions CI Workflow

**Create .github/workflows/ci.yml** (same as FliHub - see FliHub section)

### App-Specific Considerations

1. **PresentationService** - Singleton EventEmitter pattern; excellent candidate for unit tests
2. **WatcherManager** - File watching with debouncing; add logging for file discovery events
3. **Manifest Validation** - Already uses AJV for JSON Schema validation; consider Zod for runtime type checking
4. **Route Factory** - Dependency injection pattern should be tested
5. **Cheerio HTML Parsing** - The manifest sync-from-index feature parses HTML; test edge cases
6. **Config Hot Reload** - The config.json hot reload feature should have structured logging
7. **Scoped Packages** - Uses @flideck/shared namespace; ensure test imports work correctly

### Verification Steps

1. Run `npm install` at root
2. Run `npm run lint` - should pass
3. Run `npm run format:check` - should pass
4. Run `npm run typecheck` - should pass (existing script)
5. Run `npm run build` - should compile successfully
6. Run `npm test` - should run without errors
7. Commit and verify GitHub Actions CI passes

---

## Summary Table (All Complete as of 2026-02-14)

| Feature | FliHub (5101) | Storyline App (5300/5301) | FliDeck (5200/5201) |
|---------|---------------|---------------------------|---------------------|
| ESLint 9 | ✅ Complete (Jan 2026) | ✅ Complete (Feb 14, 2026) | ✅ Complete (Feb 11, 2026) |
| Prettier | ✅ Complete (Jan 2026) | ✅ Complete (Feb 14, 2026) | ✅ Complete (Feb 11, 2026) |
| Vitest Client | ✅ Complete (Jan 2026) | ✅ Complete (Feb 14, 2026) | ✅ Complete (Feb 11, 2026) |
| Vitest Server | ✅ Complete (Jan 2026) | ✅ Complete (Feb 14, 2026) | ✅ Complete (Feb 11, 2026) |
| Zod Env | ✅ Complete (Jan 2026) | ✅ Complete (Feb 14, 2026) | ✅ Complete (Feb 11, 2026) |
| Pino Logging | ✅ Complete (Jan 2026) | ✅ Complete (Feb 14, 2026) | ✅ Complete (Feb 11, 2026) |
| GitHub Actions | ✅ Complete (Jan 2026) | ✅ Complete (Feb 14, 2026) | ✅ Complete (Feb 11, 2026) |

## Common Tasks Across All Apps

### 1. Initial Setup
```bash
# Run in each app root
npm install
```

### 2. Verification Commands
```bash
# Run after completing all steps
npm run lint          # Should pass with no errors
npm run format:check  # Should pass with no errors
npm run build         # Should compile TypeScript
npm test              # Should run (even if no tests yet)
```

### 3. First Test Files

Create these sample test files to verify the setup works:

**client/src/test/App.test.tsx:**
```typescript
import { describe, it, expect } from 'vitest';

describe('Sample Client Test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
```

**server/src/test/sample.test.ts:**
```typescript
import { describe, it, expect } from 'vitest';

describe('Sample Server Test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
```

### 4. Priority Order

Suggested order for each app:

1. **ESLint + Prettier** (code quality foundation)
2. **Zod Environment Validation** (fail fast on config errors)
3. **Pino Logging** (observability during development)
4. **Vitest Testing** (enable TDD)
5. **GitHub Actions CI** (automate verification)

---

## Notes

- All package versions match FliGen's proven setup
- Each app uses the same port configuration as existing
- Workspace structure is already correct in all apps
- TypeScript configurations are already in place
- TailwindCSS v4 is already configured in all apps
- Consider creating a shared ESLint config package in future for easier maintenance
- Consider adding example tests for key utilities (naming, validation, etc.)

## Reference Files

All reference implementations can be found in:
- `/Users/davidcruwys/dev/ad/flivideo/fligen/eslint.config.js`
- `/Users/davidcruwys/dev/ad/flivideo/fligen/.prettierrc`
- `/Users/davidcruwys/dev/ad/flivideo/fligen/server/src/config/env.ts`
- `/Users/davidcruwys/dev/ad/flivideo/fligen/server/src/config/logger.ts`
- `/Users/davidcruwys/dev/ad/flivideo/fligen/server/vitest.config.ts`
- `/Users/davidcruwys/dev/ad/flivideo/fligen/.github/workflows/ci.yml`
