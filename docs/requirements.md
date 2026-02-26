# AppyStack Requirements Document

**Version**: 1.0
**Date**: 2026-02-14
**Audience**: Developers implementing AppyStack in new or existing projects

---

## Prerequisites

### Runtime Requirements

| Requirement | Minimum Version | Recommended | Check Command |
|-------------|----------------|-------------|---------------|
| **Node.js** | 20.0.0 | 20.x LTS | `node --version` |
| **npm** | 10.0.0 | Latest | `npm --version` |
| **Git** | 2.x | Latest | `git --version` |
| **gitleaks** | Any | Latest | `brew install gitleaks` |

### Knowledge Prerequisites

- TypeScript fundamentals
- React component patterns
- Express middleware concepts
- npm workspaces basics

---

## New Project Setup Checklist

### Phase 1: Project Scaffolding

- [ ] Create root directory and initialize
- [ ] Create workspace directories: `client/`, `server/`, `shared/`
- [ ] Configure root `package.json` with workspaces
- [ ] Set `"type": "module"` in root `package.json`
- [ ] Set `"engines"` to `node >=20.0.0`

### Phase 2: Shared Package

- [ ] Create `shared/package.json` with scoped name (`@projectname/shared`)
- [ ] Create `shared/tsconfig.json` (extends base config)
- [ ] Create `shared/src/types.ts` with initial shared types

### Phase 3: Server Setup

- [ ] Create `server/package.json` with scoped name
- [ ] Install core dependencies: `express`, `socket.io`, `cors`, `dotenv`, `helmet`, `compression`
- [ ] Install dev dependencies: `tsx`, `nodemon`, `typescript`, type definitions
- [ ] Create `server/tsconfig.json`
- [ ] Create `server/src/index.ts` with Express + Socket.io setup
- [ ] Create `server/src/config/env.ts` (Zod validation)
- [ ] Create `server/src/config/logger.ts` (Pino)
- [ ] Create `server/src/middleware/requestLogger.ts`
- [ ] Create `.env.example` with documented variables
- [ ] Add health check endpoint: `GET /health`

### Phase 4: Client Setup

- [ ] Create `client/package.json` with scoped name
- [ ] Install core dependencies: `react`, `react-dom`, `socket.io-client`
- [ ] Install dev dependencies: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `typescript`
- [ ] Create `client/tsconfig.json`
- [ ] Create `client/vite.config.ts` with proxy config
- [ ] Create `client/index.html`
- [ ] Create `client/src/main.tsx`
- [ ] Create `client/src/App.tsx`
- [ ] Create `client/src/styles/index.css` with TailwindCSS v4 import

### Phase 5: Quality Tooling

**This is the critical phase. Follow the exact order below.**

#### 5a. ESLint 9 + Prettier

Install at root level:

```bash
npm install --save-dev eslint@^9.39.2 @eslint/js@^9.39.2 \
  @typescript-eslint/eslint-plugin@^8.55.0 @typescript-eslint/parser@^8.55.0 \
  eslint-config-prettier@^10.1.8 eslint-plugin-react@^7.37.5 \
  eslint-plugin-react-hooks@^7.0.1 globals@^17.3.0 \
  prettier@^3.8.1
```

- [ ] Create `eslint.config.js` (flat config - NOT `.eslintrc.*`)
- [ ] Create `.prettierrc`
- [ ] Create `.prettierignore`
- [ ] Add scripts: `lint`, `lint:fix`, `format`, `format:check`
- [ ] **Run `npm run lint`** and verify it works
- [ ] **Run `npm run format`** to format all files
- [ ] **Run `npm run format:check`** and verify it passes

> **Warning**: Do NOT use `.eslintrc.cjs` or `--ext` flag with ESLint 9. See [architecture.md](./architecture.md#common-pitfalls).

#### 5b. Vitest Testing

Install in client workspace:

```bash
npm install --save-dev vitest@^4.0.18 @vitest/ui@^4.0.18 @vitest/coverage-v8@^4.0.18 \
  @testing-library/react@^16.3.2 @testing-library/jest-dom@^6.9.1 \
  @testing-library/user-event@^14.6.1 jsdom@^28.0.0 -w client
```

Install in server workspace:

```bash
npm install --save-dev vitest@^4.0.18 @vitest/ui@^4.0.18 @vitest/coverage-v8@^4.0.18 \
  supertest@^7.2.2 @types/supertest@^6.0.3 -w server
```

- [ ] Create `client/vitest.config.ts`
- [ ] Create `client/src/test/setup.ts`
- [ ] Create `server/vitest.config.ts`
- [ ] Add test scripts to client, server, AND root `package.json`
- [ ] Create at least one test file per workspace
- [ ] **Run `npm test`** and verify tests pass
- [ ] **Run `npm run test:coverage`** and verify coverage reports generate
- [ ] Add `coverage/` to `.gitignore`

#### 5c. Zod Environment Validation

```bash
npm install zod@^4.2.1 -w server
```

- [ ] Create `server/src/config/env.ts` with Zod schema
- [ ] Update `server/src/index.ts` to import from `env.ts`
- [ ] **Run `npm run dev`** and verify server starts without validation errors
- [ ] Test with invalid env: verify clear error message

#### 5d. Pino Structured Logging

```bash
npm install pino@^10.3.1 pino-pretty@^13.1.3 pino-http@^11.0.0 -w server
```

- [ ] Create `server/src/config/logger.ts`
- [ ] Create `server/src/middleware/requestLogger.ts`
- [ ] Replace `console.log` with `logger.info` throughout server
- [ ] **Run `npm run dev`** and verify pretty-formatted logs appear

#### 5e. GitHub Actions CI

- [ ] Create `.github/workflows/ci.yml`
- [ ] Verify all CI commands work locally first:
  - [ ] `npm run lint`
  - [ ] `npm run format:check`
  - [ ] `npm run build`
  - [ ] `npm test`

### Phase 6: Git & Security

- [ ] Create `.gitignore`
- [ ] Create `.gitleaksignore` (if needed)
- [ ] Set up gitleaks pre-commit hook
- [ ] Create `.env.example` (committed) with documented variables
- [ ] Verify `.env` is gitignored

---

## Quality Tooling Requirements

### Testing Requirements

| Requirement | Tool | Workspaces |
|-------------|------|------------|
| Unit tests | Vitest | Client + Server |
| Component tests | Testing Library | Client |
| API endpoint tests | Supertest | Server |
| Coverage reports | @vitest/coverage-v8 | Client + Server |
| Interactive UI | @vitest/ui | Client |

**Scripts required in each workspace**:

```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage"
}
```

**Scripts required at root**:

```json
{
  "test": "npm test -w client && npm test -w server",
  "test:client": "npm test -w client",
  "test:server": "npm test -w server",
  "test:ui": "npm run test:ui -w client",
  "test:coverage": "npm run test:coverage -w client && npm run test:coverage -w server"
}
```

### Linting Requirements

| Requirement | Details |
|-------------|---------|
| Config format | ESLint 9 flat config (`eslint.config.js`) |
| TypeScript support | `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` |
| React support | `eslint-plugin-react` + `eslint-plugin-react-hooks` |
| Prettier integration | `eslint-config-prettier` (disables conflicting rules) |
| Ignored paths | `dist/`, `build/`, `node_modules/`, `coverage/` |

**Key rules**:
- `@typescript-eslint/no-unused-vars`: error (with `^_` ignore pattern)
- `@typescript-eslint/no-explicit-any`: warn
- `react/react-in-jsx-scope`: off (React 19 doesn't need it)
- `react/prop-types`: off (TypeScript handles this)

### Formatting Requirements

| Setting | Value |
|---------|-------|
| Semi-colons | `true` |
| Quotes | Single (`'`) |
| Tab width | 2 |
| Trailing comma | `es5` |
| Print width | 100 |
| Arrow parens | `always` |

### Environment Validation Requirements

Every server must:
1. Define a Zod schema for all environment variables
2. Parse and validate at startup (before any routes)
3. Fail fast with clear error messages on invalid config
4. Export typed `env` object with helper flags (`isDevelopment`, `isProduction`, `isTest`)
5. Define defaults for all variables where sensible

**Required environment variables** (minimum):

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `NODE_ENV` | enum | `development` | Runtime environment |
| `PORT` | number | Per project | Server listen port |
| `CLIENT_URL` | URL string | Per project | CORS origin |

### Logging Requirements

| Requirement | Implementation |
|-------------|---------------|
| Logger library | Pino |
| Dev output | Pretty-printed with colors |
| Prod output | JSON (for log aggregation) |
| Request logging | pino-http middleware |
| Request tracing | UUID request IDs via `x-request-id` header |
| Log levels | `debug` (dev), `info` (prod) minimum |

### CI/CD Pipeline Requirements

The CI pipeline must run on every push to `main` and every pull request:

| Step | Command | Purpose |
|------|---------|---------|
| 1. Install | `npm ci` | Clean install |
| 2. Lint | `npm run lint` | Code quality |
| 3. Format | `npm run format:check` | Consistent formatting |
| 4. Build | `npm run build` | TypeScript compilation |
| 5. Test | `npm test` | Automated tests |

**Additional CI requirements**:
- Use `concurrency` groups to cancel in-progress runs
- Cache npm dependencies
- Run on Node.js 20.x

---

## Monorepo Workspace Requirements

### Root package.json

```json
{
  "private": true,
  "type": "module",
  "workspaces": ["client", "server", "shared"]
}
```

### Workspace Dependencies

| Workspace | Can Depend On |
|-----------|--------------|
| `client` | `shared` (via npm workspace) |
| `server` | `shared` (via `"@projectname/shared": "*"`) |
| `shared` | None (leaf package) |

### Build Order

1. `shared` (no dependencies)
2. `server` (depends on shared)
3. `client` (depends on shared, built by Vite)

---

## Port Allocation Standards

When creating a new AppyStack project:

1. Choose the next available port range (100s increment)
2. Client port = `5X00`
3. Server port = `5X01`
4. Document in project README and `.env.example`
5. Configure in `client/vite.config.ts` and `server/src/config/env.ts`

**Currently allocated**: 5100-5499. Next available: 5500.

---

## Verification Procedures

### After Initial Setup

Run these commands in order. **All must pass**.

```bash
# 1. Install dependencies
npm install

# 2. Verify linting
npm run lint
# Expected: Runs without config errors (warnings OK)

# 3. Verify formatting
npm run format:check
# Expected: "All matched files use Prettier code style!"

# 4. Verify build
npm run build
# Expected: TypeScript compiles without errors

# 5. Verify tests
npm test
# Expected: All tests pass

# 6. Verify coverage
npm run test:coverage
# Expected: Coverage reports generated in */coverage/

# 7. Verify dev server
npm run dev
# Expected: Client + server start, no errors
# Client accessible at http://localhost:5X00
# Server health check at http://localhost:5X01/health
```

### After Adding a New Feature

```bash
npm run lint          # No new lint errors
npm run format:check  # All files formatted
npm run build         # TypeScript compiles
npm test              # All tests pass (including new ones)
```

### Before Creating a Pull Request

```bash
npm run lint
npm run format:check
npm run build
npm test
# All must pass - these are the same commands CI runs
```

### Environment Validation Test

```bash
# Test with invalid PORT
PORT=invalid npm run dev
# Expected: Clear Zod error message, server does NOT start

# Test with valid config
npm run dev
# Expected: Server starts, health endpoint responds
curl http://localhost:5X01/health
# Expected: {"status":"ok","timestamp":"..."}
```

---

## Dependency Version Matrix

All AppyStack projects should use consistent dependency versions:

### Core Stack

| Package | Version | Notes |
|---------|---------|-------|
| react | ^19.1.0 | React 19 with new features |
| react-dom | ^19.1.0 | Must match React |
| vite | ^6.0.6 | Or ^7.x for newer projects |
| express | ^5.1.0 | Express 5 with async support |
| socket.io | ^4.8.1 | Server-side |
| socket.io-client | ^4.8.1 | Client-side |
| typescript | ^5.7.2 | Across all workspaces |

### Quality Tooling

| Package | Version | Notes |
|---------|---------|-------|
| vitest | ^4.0.18 | Testing framework |
| @testing-library/react | ^16.3.2 | Component testing |
| @testing-library/jest-dom | ^6.9.1 | DOM matchers |
| supertest | ^7.2.2 | API testing |
| eslint | ^9.39.2 | Flat config only |
| @eslint/js | ^9.39.2 | Must match ESLint major |
| prettier | ^3.8.1 | Code formatting |
| zod | ^4.2.1 | Schema validation |
| pino | ^10.3.1 | Structured logging |
| pino-pretty | ^13.1.3 | Dev log formatting |
| pino-http | ^11.0.0 | HTTP request logging |

### Security & Middleware

| Package | Version |
|---------|---------|
| helmet | ^8.0.0 |
| compression | ^1.7.5 |
| cors | ^2.8.5 |
| dotenv | ^16.4.7 |

---

## Implementation Priority Order

When adding quality tooling to an existing project, follow this order:

| Priority | Tool | Time Estimate | Why This Order |
|----------|------|---------------|---------------|
| 1 | ESLint + Prettier | 3-4 hours | Code quality foundation |
| 2 | Zod Environment Validation | 1-2 hours | Fail fast on config errors |
| 3 | Pino Logging | 2-3 hours | Observability during development |
| 4 | Vitest Testing | 2-3 hours | Enable test-driven development |
| 5 | GitHub Actions CI | 1-2 hours | Automate verification |

**Total estimated time**: 10-14 hours per project (including verification).

> **Lesson learned**: Initial estimates of 2.5 hours were wrong. Budget 4+ hours per tool when accounting for verification, debugging, and fixes.

---

## Common Setup Issues

| Issue | Symptom | Fix |
|-------|---------|-----|
| ESLint can't find config | "couldn't find a config file" | Use `eslint.config.js`, not `.eslintrc.*` |
| `@eslint/js` version conflict | Peer dependency error | Use `@eslint/js@^9.x` to match `eslint@^9.x` |
| `test:coverage` fails | "Cannot find @vitest/coverage-v8" | Install in BOTH client and server workspaces |
| `format:check` fails in CI | Files not formatted | Run `npm run format` locally first, commit results |
| Tailwind classes not working | Styles not applied | Use `@import "tailwindcss"` and `@source` directive (v4) |
| Server env crash | Runtime error on missing var | Check Zod schema defaults match `.env.example` |
| Shared types not found | Import resolution error | Ensure `"@projectname/shared": "*"` in server deps |

---

**See also**: [architecture.md](./architecture.md) for technical architecture details and design rationale.
