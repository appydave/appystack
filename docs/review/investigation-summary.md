# Pass 2 Investigation Summary

Compiled from 6 deep research agents. Each has a full report in this folder.

---

## Key Findings by Question Area

### A2. Error Handling (Q3-Q5) — ~112 lines of new code

| Pattern | Recommendation | Effort |
|---------|---------------|--------|
| Global Express error handler | Yes, ~40 lines. Express 5 auto-propagates async errors. | Low |
| AppError class | Minimal 12-line version with statusCode + isOperational. Skip subclasses. | Low |
| ServiceResponse helpers | Functional `apiSuccess`/`apiFailure` (~15 lines) instead of class-based. | Low |
| React Error Boundary | Yes, use `react-error-boundary` v6.1.1 + styled ErrorFallback (~25 lines). | Low |
| Zod request validation middleware | Yes, ~20 lines inline (no external package needed). | Low |

**Source**: `error-handling-validation-research.md`

### A3. Shared Package (Q6-Q8) — Keep minimal, add constants

| Finding | Detail |
|---------|--------|
| create-t3-turbo has NO generic shared package | Uses domain-specific packages (api, auth, db, ui) |
| Types-only is fine for a starter | Not an anti-pattern. Zod schemas are the upgrade path. |
| Add constants | `ROUTES` and `SOCKET_EVENTS` objects belong in shared |
| Split SocketEvents | Must become `ServerToClientEvents` + `ClientToServerEvents` |
| Don't add utilities | Date formatting, ID generation = junk drawer risk |

**Source**: `shared-package-research.md`

### A4. Build Tooling (Q9-Q11) — Stay with npm scripts

| Finding | Detail |
|---------|--------|
| Turborepo negligible for 3 packages | Real wins at 5+ packages and CI remote caching |
| npm workspaces + concurrently is correct | Add turbo when monorepo grows beyond 4 packages |

**Source**: `shared-package-research.md`

### B1. Socket.io (Q12-Q14) — 5 specific changes needed

1. Split `SocketEvents` into `ServerToClientEvents` + `ClientToServerEvents`
2. Add generics to `Server<>` constructor in server/src/index.ts
3. Add generics to `Socket<>` type in client useSocket hook
4. Add `SocketDemo` component (ping button + pong display)
5. Integrate demo into landing page

**Source**: `socket-io-research.md`

### B3. Port Config (Q17-Q18) — Vite `loadEnv` is the clean fix

Use Vite's built-in `loadEnv` helper to read `.env` from the root, making `.env` the single source of truth. Document as upgrade path, not immediate change.

**Source**: `shared-package-research.md`

### B4. ESLint Workaround (Q19-Q21) — yalc for pre-publish testing

Current `file:../config` is fine for daily dev. Use `yalc` for pre-publish testing (copies files like `npm pack`, avoids symlink resolution issues). ESLint 9 flat configs resolve plugins from the importing project by design.

**Source**: `data-fetching-and-dx-research.md`

### B5. Data Fetching (Q22-Q23) — Bare fetch + AbortController

| Option | Recommendation |
|--------|---------------|
| Bare fetch + AbortController | Yes, for the template |
| TanStack Query | Document as upgrade path in README |
| SWR | No — TanStack Query has overtaken it |
| React 19 `use()` | No — low-level primitive, not a data fetching solution |

**Source**: `data-fetching-and-dx-research.md`

### B6. Production Deployment (Q24-Q26) — Include Dockerfile

| Item | Include? |
|------|----------|
| Multi-stage Dockerfile | Yes |
| docker-compose.yml | Yes |
| Express static serving (production) | Yes, gated behind `env.isProduction` |
| Nginx config | No (cloud-specific) |

**Source**: `data-fetching-and-dx-research.md`

### C1-C6. Testing (Q27-Q40) — Hybrid approach

| Pattern | Recommendation |
|---------|---------------|
| Test structure | Hybrid: co-located `__tests__/` for units, centralized for integration/E2E |
| Hook testing | `renderHook` from `@testing-library/react` + MSW for network hooks |
| Socket.io testing | Official pattern: real connections with `createServer` + `ioc` + `waitFor` |
| MSW | Yes, set up in client package only (~30 min setup) |
| Coverage thresholds | Configure reporter but comment out thresholds until enough tests exist |
| E2E | One Playwright smoke test (page loads + API responds) |
| Reference point | bulletproof-react (~20 test files); create-t3-app ships zero tests |

**Source**: `testing-patterns-research.md`

### D1. Vitest Config (Q41-Q42) — Export fragments

Use Vitest v3's `projects` feature for node vs jsdom split. Export reusable config fragments from config package using `mergeConfig`. jsdom tests need `resolve.conditions: ['browser']`.

**Source**: `dx-tooling-and-security-research.md`

### D3. Peer Dependencies (Q45-Q46) — Follow Vercel's pattern

Required peers for ESLint/Prettier/TypeScript (auto-installed by npm 7+). Optional peers for Vitest and React plugins via `peerDependenciesMeta`.

**Source**: `dx-tooling-and-security-research.md`

### E1. Rate Limiting (Q47-Q48) — Yes, include it

`express-rate-limit` v8.2.1 with sensible defaults: 100 req/15min for API, 5 req for auth routes, IETF draft-8 standard headers.

**Source**: `dx-tooling-and-security-research.md`

### E2. Socket.io Auth (Q49-Q50) — TODO comment only

Auth middleware needs a user system, JWT infra, login flow. Add a TODO comment showing where middleware would go.

**Source**: `socket-io-research.md`

### E3. Input Validation (Q51-Q52) — 20-line inline middleware

Build your own `validateRequest` (~20 lines). No external package needed. Validates body/query/params against Zod schema.

**Source**: `error-handling-validation-research.md`

### F1. Debug Configs (Q53-Q54) — Ship them

Include `.vscode/launch.json` with 4 configs: Debug Server (tsx), Attach to Server, Debug Client (Chrome), Debug Current Test (Vitest). Plus a Full Stack compound.

**Source**: `dx-tooling-and-security-research.md`

### F2. Git Hooks (Q55-Q56) — Husky v9 + lint-staged

Still the standard (~7M weekly downloads). Lefthook is the strongest alternative but adds friction. simple-git-hooks used by Vue core.

**Source**: `dx-tooling-and-security-research.md`

### F3. Customization (Q57-Q58) — @clack/prompts

`@clack/prompts` (used by create-t3-app, SvelteKit) for interactive setup script with project name, ports, org name.

**Source**: `dx-tooling-and-security-research.md`

---

## Research Reports (full detail)

- `testing-patterns-research.md` — Testing infrastructure across reference projects
- `error-handling-validation-research.md` — Error handling and Zod validation patterns
- `shared-package-research.md` — Shared packages, turborepo, port coordination
- `socket-io-research.md` — Socket.io typed events, hooks, auth, demo patterns
- `data-fetching-and-dx-research.md` — Data fetching, deployment, ESLint workarounds
- `dx-tooling-and-security-research.md` — Git hooks, rate limiting, debug configs, peer deps, scaffolding
