# AGENTS.md — AppyStack Wave 4 Campaign

## What This Is

Operational knowledge for a Ralph Wiggum Task Agent campaign. Each agent receives this file + a specific work unit prompt.

**Campaign**: AppyStack Wave 4 — Documentation suite, client env validation, state management pattern, Socket.io resilience, JSDoc
**Repo**: `/Users/davidcruwys/dev/ad/apps/appystack`
**Template**: `/Users/davidcruwys/dev/ad/apps/appystack/template/`
**Docs**: `/Users/davidcruwys/dev/ad/apps/appystack/docs/`
**GitHub repo**: `https://github.com/appydave/appystack`
**npm package**: `@appydave/appystack-config` (published, v1.0.3)

**Prerequisite**: Wave 3 complete. MSW, RHF+Zod, API wrapper, and all test completeness work from Wave 3 must be merged before Wave 4 starts. Wave 4 docs reference Wave 3 patterns.

---

## Build & Run Commands

```bash
cd /Users/davidcruwys/dev/ad/apps/appystack/template

npm install
npm run dev
npm run build
npm test
npm run format:check
npm run lint
npm run typecheck
npm run format           # fix formatting
```

---

## Directory Structure

```
docs/                                      # Wave 4: new docs written here
  architecture.md                          # existing — reference for patterns
  requirements.md                          # existing — reference for setup steps
  getting-started.md                       # existing
  troubleshooting.md                       # Wave 4 WU-1 — new
  socket-io.md                             # Wave 4 WU-2 — new
  extending-configs.md                     # Wave 4 WU-3 — new
  testing-guide.md                         # Wave 4 WU-4 — new
  api-design.md                            # Wave 4 WU-5 — new
  environment.md                           # Wave 4 WU-6 — new
  deployment.md                            # Wave 4 WU-7 — new

template/
  client/
    src/config/env.ts                      # Wave 4 WU-8 — new (client env validation)
    src/contexts/AppContext.tsx            # Wave 4 WU-9 — new (state management pattern)
    src/contexts/AppContext.test.tsx       # Wave 4 WU-9 — new
    src/hooks/useSocket.ts                 # Wave 4 WU-10 — update reconnection options
    src/utils/api.ts                       # Wave 3 output — reference in docs
    src/components/ContactForm.tsx         # Wave 3 output — reference in docs
    src/test/msw/                          # Wave 3 output — reference in docs
  server/
    src/config/env.ts                      # Wave 4 WU-11 — add JSDoc
    src/config/logger.ts                   # Wave 4 WU-11 — add JSDoc
  shared/
    src/types.ts                           # Wave 4 WU-11 — add JSDoc
    src/constants.ts                       # Wave 4 WU-11 — add JSDoc
```

---

## Quality Gates

For **code work units** (WU-8, WU-9, WU-10, WU-11):
```bash
cd /Users/davidcruwys/dev/ad/apps/appystack/template
npm run format:check   # must pass
npm run lint           # must pass
npm run build          # must compile
npm test               # must pass, count must not decrease
```

For **documentation work units** (WU-1 through WU-7):
- File must exist at the specified path
- Length must be within the target range (see Notes)
- All code examples in docs must be syntactically correct TypeScript/JavaScript
- All file paths referenced in docs must actually exist in the repo
- Cross-references to other docs must use relative paths (`./troubleshooting.md`)
- No references to old package names (`@flivideo/config` is dead — use `@appydave/appystack-config`)

---

## Documentation Writing Standards

### Structure for all docs
```markdown
# [Title]

> One-sentence summary of what this doc covers.

## [Section]

[Content]

### [Subsection]

[Code example or explanation]
```

### Code examples — always typed, always runnable
- Use TypeScript for all code examples
- Include imports at top of each snippet
- Show both the happy path AND the error case
- Reference actual files in the repo where patterns live

### Cross-references
```markdown
See [architecture.md](./architecture.md) for the full stack overview.
See [testing-guide.md](./testing-guide.md) for how to test socket events.
```

### Tone
- Direct and practical — assume developer audience
- "Do this" not "you might want to consider doing this"
- Show the code first, explain after
- Prefer short examples over long explanations

---

## Documentation Content Guides

### WU-1: troubleshooting.md (200-300 lines)
Cover these specific known issues:
1. **Shared build order** — server imports `shared/dist/` — run `npm run build -w shared` first
2. **Vite tsconfig warning** — non-fatal "Cannot find base config @appydave/appystack-config/typescript/react" — explain why, confirm TypeScript still works
3. **Port conflicts** — how to find what's using port 5500/5501, how to change ports
4. **ESLint fails silently** — ESLint 9 ignores `.eslintrc.*` files — check for legacy config files
5. **Socket.io won't connect** — CORS origin mismatch (CLIENT_URL env var), proxy config in vite.config.ts
6. **Husky hooks not running** — repo is nested, husky init won't work in template/
7. **npm install fails** — workspace hoisting issues, try `npm install --legacy-peer-deps`
8. **Prettier formats differently than expected** — check .prettierrc, check .prettierignore, check editor settings
9. **Tests fail on CI but pass locally** — NODE_ENV differences, missing Playwright browsers
10. **coverage below threshold** — which files to check, how to exclude files

### WU-2: socket-io.md (250-350 lines)
Cover:
1. How typed socket events work (ServerToClientEvents / ClientToServerEvents in shared/src/types.ts)
2. Step-by-step: adding a new event (shared types → server handler → client hook → component)
3. Testing socket events (reference Wave 3 E2E socket test + server socket.test.ts)
4. Common pitfalls: event name mismatches, forgetting to cleanup listeners, memory leaks on component unmount
5. Reconnection behaviour (reference Wave 4 WU-10 reconnection config)
6. Socket auth pattern (reference Wave 3 WU-12 commented example in index.ts)
7. Debugging: socket.io client devtools, logging socket events

### WU-3: extending-configs.md (150-200 lines)
Cover:
1. How the config inheritance chain works (base.json → react.json/node.json)
2. Adding a custom ESLint rule in a consumer project (override, not fork)
3. Extending TypeScript options in a consumer tsconfig
4. Adding a custom Vitest setup file
5. Overriding Prettier settings per-project
6. When to fork vs extend (fork only if you need to remove an inherited rule)

### WU-4: testing-guide.md (300-400 lines)
Cover:
1. Test strategy: what to test at each level (unit / integration / E2E)
2. Server testing: Vitest + Supertest patterns (reference existing server tests)
3. Client testing: Vitest + Testing Library patterns (reference existing client tests)
4. MSW usage: when to use MSW vs mocking hooks (reference Wave 3 MSW setup)
5. Socket.io testing: real server on port 0 pattern (reference socket.test.ts)
6. Coverage: what 80%/70% thresholds mean, how to check coverage, what to exclude
7. CI testing: how GitHub Actions runs tests (reference .github/workflows/ci.yml)
8. Common mistakes: shared state between tests, missing cleanup, async timing

### WU-5: api-design.md (200-250 lines)
Cover:
1. Route organisation (Router pattern, mounting in index.ts)
2. Request validation with Zod (reference validate.ts middleware)
3. Response shape (apiSuccess / apiFailure helpers)
4. Error responses (AppError class, status codes, when to use each)
5. Adding a new endpoint (step-by-step)
6. API versioning strategy (prefix pattern: /api/v1/)
7. Using the API wrapper from the client (reference Wave 3 api.ts)

### WU-6: environment.md (150-200 lines)
Cover:
1. Required vs optional vars (table: var name, default, required, description)
2. Server vars: NODE_ENV, PORT, CLIENT_URL
3. Client vars: VITE_API_URL, VITE_APP_NAME
4. How to add a new env var (server: extend Zod schema, client: extend vite-env.d.ts)
5. Secrets: never commit .env, use .env.example as documentation
6. CI secrets: GitHub secrets for NPM_TOKEN
7. Environment-specific configs: .env.development, .env.production (Vite conventions)

### WU-7: deployment.md (200-250 lines)
Cover:
1. Production build steps (npm run build, output locations)
2. Docker usage (reference template Dockerfile, docker-compose)
3. Environment variables in production
4. Health check endpoint (/health) for load balancers
5. CORS configuration for production domains (CLIENT_URL env var)
6. Static file serving (Express serves client/dist in production)
7. Production checklist (12-15 items: env vars set, CORS configured, rate limiting on, etc.)

---

## Client Env Validation Pattern (WU-8)

VITE_ vars cannot use Node's Zod schema (no process.env in browser). Use a lightweight manual validation:

```typescript
// client/src/config/env.ts
function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value as string;
}

function optionalEnv(key: string, defaultValue: string): string {
  return (import.meta.env[key] as string | undefined) ?? defaultValue;
}

export const clientEnv = {
  apiUrl: optionalEnv('VITE_API_URL', ''),
  appName: optionalEnv('VITE_APP_NAME', 'AppyStack'),
  // TODO: Add your required vars here using requireEnv()
};
```

---

## State Management Pattern (WU-9)

Context API with useReducer — shows the pattern, consumer picks the library:

```typescript
// client/src/contexts/AppContext.tsx
import { createContext, useContext, useReducer, ReactNode } from 'react';

type State = { count: number };
type Action = { type: 'increment' } | { type: 'decrement' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment': return { count: state.count + 1 };
    case 'decrement': return { count: state.count - 1 };
    default: return state;
  }
}

const AppContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { count: 0 });
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
```

---

## Socket.io Reconnection Config (WU-10)

Update `useSocket.ts` io() call with conservative reconnection options:

```typescript
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,      // give up after 5 attempts
  reconnectionDelay: 1000,      // start with 1s delay
  reconnectionDelayMax: 5000,   // cap at 5s
  randomizationFactor: 0.5,     // add jitter to avoid thundering herd
});
```

Add inline comments explaining each option.

---

## Anti-Patterns — DO NOT DO THESE

- **NO `@flivideo/config` references** — all docs must use `@appydave/appystack-config`
- **NO untested code in WU-8, WU-9, WU-10, WU-11** — code changes need tests or typecheck pass
- **NO Redux, Zustand, or Jotai** — WU-9 is Context API only, pattern demonstration
- **NO real Zod in client env** — VITE_ vars aren't available via process.env, use manual validation
- **NO docs without code examples** — every doc section must show working code
- **NO broken file path references in docs** — verify paths exist before writing

---

## Operational Notes (Inherited)

- **Husky**: do not re-run `npx husky init`
- **Express 5**: `req.query` is read-only
- **ESLint 9**: flat config only
- **Build order**: shared → server → client
- **Vite tsconfig warning**: non-fatal, do not attempt to fix
- **console.error in env.ts**: intentional, circular dep prevention
