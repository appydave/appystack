# AppyStack Template — Review Questions & Investigation Points

**Purpose**: Questions a consultant would ask after reviewing what the architect designed and the developer built. Pass 1 = questions only. Pass 2 = deep investigation and answers.

**Context**: 39-file RVETS template built across 6 phases. Architect wrote `docs/plans/appystack-boilerplate-template.md`. Developer implemented it in a single session. Five reference projects were analyzed in `docs/historical/` but findings may not have been fully applied.

---

## A. Architecture Gaps — Did We Learn From the Reference Projects?

### A1. Feature-Based vs Layer-Based Structure

The `docs/historical/external-repos-analysis.md` flags bulletproof-react's feature-based architecture as a key finding. The template uses layer-based (`components/`, `hooks/`, `pages/`).

- **Q**: Should a starter template demonstrate feature-based structure, or is layer-based correct for a boilerplate that will be restructured anyway?
- **Q**: Did any of the 5 reference repos use layer-based for small projects and switch to feature-based at scale? What was the threshold?
- **Investigate**: What does bulletproof-react actually recommend for projects with <10 routes?

### A2. Error Handling Architecture

Express-typescript-2024 recommends an `AppError` class hierarchy and `ServiceResponse` pattern. Our template has neither.

- **Q**: Do the reference projects implement centralized error handling in their starter templates, or only in mature apps?
- **Q**: Should a boilerplate ship with a global Express error handler and React error boundary, even if they're minimal?
- **Q**: What's the minimum viable error handling pattern that doesn't add complexity but prevents silent failures?
- **Investigate**: How does express-typescript-2024 structure its error middleware? How many lines of code is it?

### A3. Shared Package Depth

Our shared package exports 4 TypeScript interfaces and nothing else. No utilities, validators, constants, or error types.

- **Q**: What do the reference monorepo templates (create-t3-turbo, bulletproof-react) put in their shared/common packages?
- **Q**: Should shared include Zod schemas that both client and server import, enabling runtime validation of API responses on both sides?
- **Q**: Is a types-only shared package an anti-pattern that discourages code sharing?
- **Investigate**: What shared utilities appear in real RVETS-style projects? (e.g., date formatting, ID generation, validation schemas)

### A4. Build Tool Configuration

Turbo/turborepo patterns (task dependencies, output caching, input detection) were documented in historical analysis but not applied.

- **Q**: Should the template use turborepo instead of npm scripts for the build pipeline?
- **Q**: What's the actual build time difference for a 3-workspace monorepo with and without turbo caching?
- **Q**: Is npm workspaces + concurrently sufficient, or are we leaving significant DX on the table?
- **Investigate**: What build orchestration do the 5 reference repos use?

---

## B. Implementation Quality — Could This Be Better?

### B1. Socket.io: Demo or Real Pattern?

The server defines `client:ping` and `server:message` events. The client's `useSocket` hook connects but **never emits or listens to custom events**. The `SocketEvents` type in shared is unused at runtime.

- **Q**: Is an unfinished Socket.io demo worse than no Socket.io at all? Does it mislead template users?
- **Q**: What's the minimum viable Socket.io pattern that proves the full round-trip works?
- **Q**: Should the template include a visible "connection test" (button that pings, shows pong) rather than just a green dot?
- **Investigate**: How do Socket.io starter templates typically demonstrate the connection? What events do they show?

### B2. Unused Dependencies

`formidable` is installed in server/package.json but never imported or used.

- **Q**: Are there other phantom dependencies across the 3 workspaces?
- **Q**: Should we audit `npm ls` against actual imports to find bloat?
- **Investigate**: Run a dependency audit — what's installed vs what's imported?

### B3. Port Configuration Duplication

Port 5501 appears in `server/src/config/env.ts`, `client/vite.config.ts`, and `.env.example`. Changing ports requires editing 3 files.

- **Q**: Can the Vite proxy read the server port from an env var or shared config?
- **Q**: How do the reference projects handle port coordination between client and server?
- **Investigate**: What's the cleanest pattern for port config in a monorepo with Vite proxy?

### B4. ESLint Config Workaround

The eslint.config.js is fully inlined (66 lines) because `file:` linked packages can't resolve peer dependencies. This is documented as temporary.

- **Q**: Is there a better workaround for pre-publish development? (e.g., `npm link`, `yalc`, workspace hoisting)
- **Q**: Will this "temporary" workaround become permanent technical debt?
- **Q**: After npm publish, will consumers actually remember to switch from inlined to imported config?
- **Investigate**: How do other config packages handle the pre-publish development loop?

### B5. Fetch Without Abort/Timeout

`useServerStatus` uses bare `fetch()` with no AbortController or timeout. Could hang indefinitely.

- **Q**: Should starter templates demonstrate AbortController cleanup in useEffect, or is that over-engineering for a boilerplate?
- **Q**: What's the modern React pattern for fetch-with-cleanup in 2026?
- **Investigate**: What do React starter templates recommend for data fetching? (fetch, tanstack-query, SWR, etc.)

### B6. Production Deployment Gap

No guidance on production builds — where the client bundle goes, reverse proxy config, static file serving from Express, or environment variable injection at build time.

- **Q**: Should a starter template include a Dockerfile or docker-compose.yml?
- **Q**: Should there be a production Express config that serves the built client?
- **Q**: What's the deployment story the reference projects tell?
- **Investigate**: Do any of the 5 reference repos include deployment examples?

---

## C. Testing & Quality — The Biggest Gap

### C1. Test Coverage Is ~15-20%

2 test files total: `server/src/test/health.test.ts` (2 tests) and `client/src/test/App.test.tsx` (3 tests). All happy-path.

- **Q**: What test coverage should a boilerplate template ship with? Is "example tests" enough, or should it demonstrate testing patterns for each layer?
- **Q**: Should the template include tests that deliberately fail to show how error reporting works?
- **Investigate**: What test files do the reference starter templates include? How many? What patterns do they demonstrate?

### C2. Hooks Are Mocked, Not Tested

Client tests mock `useServerStatus` and `useSocket` entirely. The actual hook logic (fetch calls, socket connection, state management) is never exercised.

- **Q**: Should the template include hook-specific tests using `renderHook`?
- **Q**: Is mocking hooks in component tests an anti-pattern for a boilerplate that's supposed to teach patterns?
- **Q**: What's the testing-library recommended approach for hooks that do network calls?
- **Investigate**: How does bulletproof-react test custom hooks?

### C3. Socket.io Is Untested

No tests for Socket connection, disconnection, event emission, or event handling. On either side.

- **Q**: How do you unit test Socket.io in Vitest? Is there a standard mock pattern?
- **Q**: Should there be an integration test that spins up both server and client?
- **Investigate**: What Socket.io testing patterns exist in the npm ecosystem? (socket.io-mock, etc.)

### C4. No Integration Tests

All tests are isolated unit tests. No test verifies client-to-server communication through the Vite proxy.

- **Q**: Should the template include at least one integration test that proves the proxy works?
- **Q**: Is Playwright overkill for a template, or should there be a basic E2E smoke test?
- **Investigate**: What integration testing patterns do the reference monorepos use?

### C5. Missing Test Infrastructure

The historical docs mention Mock Service Worker (MSW), `renderWithProviders` test utilities, and co-located test files. None are present.

- **Q**: Should MSW be pre-configured in the template for API mocking?
- **Q**: Should test utilities be in shared/ so both client and server can use them?
- **Q**: Is co-locating tests (`Component.test.tsx` next to `Component.tsx`) better than the current `test/` directory pattern?
- **Investigate**: What test infrastructure does create-t3-turbo include? What about bulletproof-react?

### C6. No Coverage Thresholds

Coverage reporting is configured (`vitest --coverage`) but no minimum thresholds are enforced. CI doesn't fail on coverage drops.

- **Q**: Should the template enforce coverage thresholds? What percentages?
- **Q**: Should the CI pipeline include coverage reporting?
- **Investigate**: What coverage thresholds do the reference projects enforce?

---

## D. Config Package Readiness

### D1. Missing Vitest Client Config

The config package exports `./vitest/server` but not `./vitest/client`. The template creates its own client vitest config with jsdom.

- **Q**: Should `@appydave/appystack-config` export a client vitest config?
- **Q**: Would a shared vitest base config with environment as a parameter be better than server/client split?
- **Investigate**: How do other shared config packages handle vitest configs?

### D2. Package.json Cleanup

Config package has `"main": "index.js"` pointing to a file that doesn't exist. No `"files"` field. No `"repository"` field.

- **Q**: What fields should be in the config package.json before npm publish?
- **Q**: Should there be a `prepublishOnly` script that validates the package?
- **Investigate**: What does `npm pack --dry-run` include? Is anything missing or extra?

### D3. Peer Dependency Strategy

8 peer dependencies means consumers must install them manually. This is intentional but friction-heavy.

- **Q**: Is there a better pattern? (e.g., `peerDependenciesMeta` with optional flags, install scripts, or documentation)
- **Q**: Do consumers actually know which peer deps to install? Is the error message clear enough?
- **Investigate**: How do popular config packages (eslint-config-airbnb, @vercel/style-guide) handle peer deps?

---

## E. Security & Hardening

### E1. No Rate Limiting

No request rate limiting on any endpoint. Health check and info endpoints are unprotected.

- **Q**: Should a template include rate limiting by default, or is that app-specific?
- **Q**: What's the minimal rate limiting setup for Express 5?
- **Investigate**: Do the reference Express templates include rate limiting?

### E2. Socket.io Without Authentication

Socket.io accepts all connections without any auth check.

- **Q**: Should the template demonstrate Socket.io middleware for connection auth?
- **Q**: What's the standard pattern for Socket.io auth in 2026?
- **Investigate**: How do the reference projects handle WebSocket authentication?

### E3. No Input Validation Beyond Env

Zod validates environment variables but no request body/query/param validation middleware exists.

- **Q**: Should there be a Zod validation middleware example for at least one endpoint?
- **Q**: Is there a standard Express + Zod middleware pattern?
- **Investigate**: How does express-typescript-2024 handle request validation?

---

## F. Developer Experience

### F1. No Debugging Configuration

No `.vscode/launch.json`, no `--inspect` flag in dev scripts, no debugging guidance.

- **Q**: Should the template include VS Code debug configurations?
- **Q**: What about Chrome DevTools debugging for the server?
- **Investigate**: What DX files do the reference templates include?

### F2. No Git Hooks

No husky, no lint-staged, no pre-commit checks. Developers can commit unformatted/unlinted code.

- **Q**: Should the template include pre-commit hooks?
- **Q**: Is husky + lint-staged still the standard in 2026, or has something replaced it?
- **Investigate**: What git hook setup do the reference projects use?

### F3. Customization Workflow

The plan says "search for TODO, rename, change ports" but there's no script or checklist to automate this.

- **Q**: Should there be an `npm run customize` script that prompts for project name, ports, etc.?
- **Q**: Would a simple sed-based rename script be more practical?
- **Investigate**: How do other boilerplate templates handle project customization? (create-t3-app, create-vite, etc.)

---

## G. Meta-Process — How We Built This

### G1. Single-Session Implementation

All 39 files were created in one Claude Code session (~8 minutes of generation across 6 phases).

- **Q**: Should there have been a review checkpoint between phases?
- **Q**: Were the vitest version error (4.1.1 vs 4.0.18) and the ESLint peer dep issue caught quickly enough, or do they indicate insufficient pre-research?

### G2. Historical Analysis Utilization

Five reference projects were analyzed in `docs/historical/external-repos-analysis.md`. The architect wrote the plan. The developer implemented it.

- **Q**: Which specific findings from the external analysis made it into the template?
- **Q**: Which findings were noted as important but deferred? Were the deferral reasons valid?
- **Q**: Is the gap between "what we learned" and "what we built" acceptable for a v0.1.0?

### G3. Plan Fidelity

The implementation plan specified 39 files across 6 phases with verification steps.

- **Q**: Did every verification step actually run? (The raw.txt shows some did)
- **Q**: Were there any deviations from the plan? If so, were they improvements or compromises?
- **Q**: Should the plan have included more specific acceptance criteria per file?

---

## Priority Order for Investigation (Pass 2)

**High priority** (would significantly improve the template):
1. C1-C6: Testing gaps (biggest risk area)
2. B1: Socket.io completeness (misleading current state)
3. A2: Error handling patterns (prevents silent failures)
4. A3: Shared package depth (missed opportunity)

**Medium priority** (would improve DX and quality):
5. B5: Data fetching patterns
6. F2: Git hooks
7. E3: Input validation example
8. B6: Production deployment guidance

**Lower priority** (nice-to-have for v0.1.0):
9. A1: Feature-based structure
10. A4: Build tooling (turbo)
11. F1: Debug configuration
12. F3: Customization automation
