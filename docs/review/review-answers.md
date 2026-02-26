# AppyStack Template — Review Q&A

**Date**: 2025-02-15
**Interviewee**: David Cruwys (Product Owner / Architect)
**Interviewer**: Claude (Consultant)

---

## A. Architecture Gaps (11 questions)

### A1. Feature-Based vs Layer-Based Structure

**Q1**: Should a starter template demonstrate feature-based structure, or is layer-based correct for a boilerplate that will be restructured anyway?
> **A**: Layer-based is fine. Template is small, layer-based is simpler. Users restructure when they scale.

**Q2**: Did any of the 5 reference repos use layer-based for small projects and switch to feature-based at scale? What was the threshold?
> **A**: Don't know yet — needs investigation in Pass 2.

### A2. Error Handling Architecture

**Q3**: Do the reference projects implement centralized error handling in their starter templates, or only in mature apps?
> **A**: Investigation complete. Starters have minimal error handling (~13 lines). Recommendation: add ~40 line global handler, 12-line AppError class, functional apiSuccess/apiFailure helpers, React error boundary via react-error-boundary. ~112 lines total. **Accepted.**

**Q4**: Should a boilerplate ship with a global Express error handler and React error boundary, even if they're minimal?
> **A**: Yes. Both are low effort and prevent silent failures. **Accepted.**

**Q5**: What's the minimum viable error handling pattern that doesn't add complexity but prevents silent failures?
> **A**: Global Express error middleware (~40 lines) + minimal AppError class (12 lines) + react-error-boundary + Zod validation middleware (~20 lines). See `error-handling-validation-research.md`. **Accepted.**

### A3. Shared Package Depth

**Q6**: What do the reference monorepo templates (create-t3-turbo, bulletproof-react) put in their shared/common packages?
> **A**: Investigation complete. create-t3-turbo has NO generic shared package — uses domain-specific packages. Types-only is fine for a starter. Add constants (ROUTES, SOCKET_EVENTS). Split SocketEvents into ServerToClientEvents + ClientToServerEvents. **Accepted.**

**Q7**: Should shared include Zod schemas that both client and server import, enabling runtime validation of API responses on both sides?
> **A**: Not for the template. Document Zod schemas as the upgrade path. Plain interfaces are simpler to understand. **Accepted.**

**Q8**: Is a types-only shared package an anti-pattern that discourages code sharing?
> **A**: No. Types + constants is the right level for a starter. Avoid "junk drawer" utilities. **Accepted.**

### A4. Build Tool Configuration

**Q9**: Should the template use turborepo instead of npm scripts for the build pipeline?
> **A**: No. Turborepo is negligible for 3 packages. Real wins at 5+ packages. Stay with npm scripts + concurrently. **Accepted.**

**Q10**: What's the actual build time difference for a 3-workspace monorepo with and without turbo caching?
> **A**: Negligible for 3 packages. Add turbo when monorepo grows beyond 4 packages. **Accepted.**

**Q11**: Is npm workspaces + concurrently sufficient, or are we leaving significant DX on the table?
> **A**: Sufficient. No significant DX gap. **Accepted.**

---

## B. Implementation Quality (15 questions)

### B1. Socket.io: Demo or Real Pattern?

**Q12**: Is an unfinished Socket.io demo worse than no Socket.io at all? Does it mislead template users?
> **A**: Yes, fix it. An incomplete demo is misleading. Complete the round-trip.

**Q13**: What's the minimum viable Socket.io pattern that proves the full round-trip works?
> **A**: Add a ping button + pong display so the full round-trip is proven visually.

**Q14**: Should the template include a visible "connection test" (button that pings, shows pong) rather than just a green dot?
> **A**: Yes (same as Q12-13).

### B2. Unused Dependencies

**Q15**: Are there other phantom dependencies across the 3 workspaces?
> **A**: Yes, audit and clean. Bloat in a starter template sends wrong signals.

**Q16**: Should we audit `npm ls` against actual imports to find bloat?
> **A**: Yes (same as Q15).

### B3. Port Configuration Duplication

**Q17**: Can the Vite proxy read the server port from an env var or shared config?
> **A**: Yes — Vite's built-in `loadEnv` helper can read root `.env`. Document as upgrade path, current hardcoded approach is acceptable. **Accepted.**

**Q18**: How do the reference projects handle port coordination between client and server?
> **A**: Most hardcode. Vite `loadEnv` is the clean fix. **Accepted.**

### B4. ESLint Config Workaround

**Q19**: Is there a better workaround for pre-publish development? (e.g., npm link, yalc, workspace hoisting)
> **A**: Current `file:../config` is fine for daily dev. Use yalc for pre-publish testing. ESLint 9 resolves plugins from the importing project by design. **Accepted.**

**Q20**: Will this "temporary" workaround become permanent technical debt?
> **A**: No — resolves after npm publish. yalc bridges the gap. **Accepted.**

**Q21**: After npm publish, will consumers actually remember to switch from inlined to imported config?
> **A**: TODO comment is sufficient. Will be part of the npm publish migration. **Accepted.**

### B5. Fetch Without Abort/Timeout

**Q22**: Should starter templates demonstrate AbortController cleanup in useEffect, or is that over-engineering for a boilerplate?
> **A**: Yes — add AbortController to useServerStatus. It's best practice, not over-engineering. Document TanStack Query as the upgrade path. **Accepted.**

**Q23**: What's the modern React pattern for fetch-with-cleanup in 2026?
> **A**: Bare fetch + AbortController in useEffect. TanStack Query has overtaken SWR but is too opinionated for a template. **Accepted.**

### B6. Production Deployment Gap

**Q24**: Should a starter template include a Dockerfile or docker-compose.yml?
> **A**: Yes — include all three: multi-stage Dockerfile, docker-compose.yml, and Express static serving gated behind env.isProduction. **Accepted.**

**Q25**: Should there be a production Express config that serves the built client?
> **A**: Yes, gated behind `env.isProduction`. **Accepted.**

**Q26**: What's the deployment story the reference projects tell?
> **A**: Include Dockerfile + docker-compose. Skip Nginx/cloud-specific configs. **Accepted.**

---

## C. Testing & Quality (14 questions)

### C1. Test Coverage

**Q27**: What test coverage should a boilerplate template ship with? Is "example tests" enough, or should it demonstrate testing patterns for each layer?
> **A**: High unit test coverage with Vitest is the priority. This template is a personal boilerplate for many apps — it must be sound. Pattern demos for each type of unit test (route, hook, component, socket). Not a fan of mocks — they hide errors. Test against real behavior. **Accepted.**

**Q28**: Should the template include tests that deliberately fail to show how error reporting works?
> **A**: Not needed. Focus on comprehensive unit tests with real behavior.

### C2. Hooks Are Mocked, Not Tested

**Q29**: Should the template include hook-specific tests using `renderHook`?
> **A**: Yes. Test hooks against a real lightweight server (Supertest-style), not mocks. Real behavior, real verification. **Accepted.**

**Q30**: Is mocking hooks in component tests an anti-pattern for a boilerplate that's supposed to teach patterns?
> **A**: Yes — mocks hide errors. Test with real servers where possible. **Accepted.**

**Q31**: What's the testing-library recommended approach for hooks that do network calls?
> **A**: Use renderHook with a real lightweight Express server in test setup (Supertest-style). Avoid MSW/mocks. **Accepted.**

### C3. Socket.io Is Untested

**Q32**: How do you unit test Socket.io in Vitest? Is there a standard mock pattern?
> **A**: Yes, add socket tests. At minimum, test the server-side event handlers. Ideally test the round-trip.

**Q33**: Should there be an integration test that spins up both server and client?
> **A**: Yes (same as Q32).

### C4. No Integration Tests

**Q34**: Should the template include at least one integration test that proves the proxy works?
> **A**: Yes — one Playwright smoke test: page loads, status cards render, /health returns 200. Safety net. **Accepted.**

**Q35**: Is Playwright overkill for a template, or should there be a basic E2E smoke test?
> **A**: One smoke test is justified. Not a testing strategy, just a safety net. **Accepted.**

### C5. Missing Test Infrastructure

**Q36**: Should MSW be pre-configured in the template for API mocking?
> **A**: No. Not a fan of mocks — they hide errors. Test against real servers instead. **Accepted.**

**Q37**: Should test utilities be in shared/ so both client and server can use them?
> **A**: Shared test helpers are fine if they avoid mocking. Real server setup utilities belong in shared.

**Q38**: Is co-locating tests (`Component.test.tsx` next to `Component.tsx`) better than the current `test/` directory pattern?
> **A**: Yes — co-located tests. Easy to find, easy to maintain, see gaps at a glance. **Accepted.**

### C6. No Coverage Thresholds

**Q39**: Should the template enforce coverage thresholds? What percentages?
> **A**: Configure @vitest/coverage-v8 with commented-out threshold examples (80%). Ready to uncomment per-project. **Accepted.**

**Q40**: Should the CI pipeline include coverage reporting?
> **A**: Yes, configure the reporter. Don't enforce thresholds until enough tests exist. **Accepted.**

---

## D. Config Package Readiness (6 questions)

### D1. Missing Vitest Client Config

**Q41**: Should `@appydave/appystack-config` export a client vitest config?
> **A**: Yes — export both vitest/client (jsdom) and vitest/server (node). Use Vitest v3 projects feature and mergeConfig for reusable fragments. **Accepted.**

**Q42**: Would a shared vitest base config with environment as a parameter be better than server/client split?
> **A**: Export fragments via mergeConfig. jsdom tests need `resolve.conditions: ['browser']`. **Accepted.**

### D2. Package.json Cleanup

**Q43**: What fields should be in the config package.json before npm publish?
> **A**: Fix the fields AND add a prepublishOnly script that runs npm pack --dry-run + validates exports.

**Q44**: Should there be a `prepublishOnly` script that validates the package?
> **A**: Yes (same as Q43).

### D3. Peer Dependency Strategy

**Q45**: Is there a better pattern for peer deps? (e.g., peerDependenciesMeta with optional flags, install scripts, or documentation)
> **A**: Follow Vercel's pattern: required peers for ESLint/Prettier/TypeScript (auto-installed by npm 7+), optional peers for Vitest and React plugins via peerDependenciesMeta. **Accepted.**

**Q46**: Do consumers actually know which peer deps to install? Is the error message clear enough?
> **A**: npm 7+ auto-installs required peers. Optional peers handled by peerDependenciesMeta. **Accepted.**

---

## E. Security & Hardening (6 questions)

### E1. No Rate Limiting

**Q47**: Should a template include rate limiting by default, or is that app-specific?
> **A**: Yes — include express-rate-limit v8.2.1 with sensible defaults: 100 req/15min for API, IETF draft-8 headers. **Accepted.**

**Q48**: What's the minimal rate limiting setup for Express 5?
> **A**: express-rate-limit with windowMs: 15*60*1000, limit: 100. Include in security middleware stack alongside Helmet + CORS. **Accepted.**

### E2. Socket.io Without Authentication

**Q49**: Should the template demonstrate Socket.io middleware for connection auth?
> **A**: No — auth middleware needs a user system. Add a TODO comment showing where middleware would go. **Accepted.**

**Q50**: What's the standard pattern for Socket.io auth in 2026?
> **A**: `socket.handshake.auth.token` on server, `auth: { token }` on client. Document as TODO. **Accepted.**

### E3. No Input Validation Beyond Env

**Q51**: Should there be a Zod validation middleware example for at least one endpoint?
> **A**: Yes — 20-line inline `validateRequest` middleware. No external package needed. **Accepted.**

**Q52**: Is there a standard Express + Zod middleware pattern?
> **A**: Build your own (~20 lines). External packages are either abandoned or too heavy. **Accepted.**

---

## F. Developer Experience (6 questions)

### F1. No Debugging Configuration

**Q53**: Should the template include VS Code debug configurations?
> **A**: Needs investigation — research recommends shipping .vscode/launch.json with 4 configs (Debug Server, Attach, Debug Client Chrome, Debug Current Test) + Full Stack compound. Awaiting final decision.

**Q54**: What about Chrome DevTools debugging for the server?
> **A**: Same as Q53 — covered by the Attach to Server config with --inspect flag.

### F2. No Git Hooks

**Q55**: Should the template include pre-commit hooks?
> **A**: Yes, add husky + lint-staged. Pre-commit formatting/linting prevents CI failures. Standard practice.

**Q56**: Is husky + lint-staged still the standard in 2026, or has something replaced it?
> **A**: Yes, add them (same as Q55). Investigate if alternatives exist in Pass 2.

### F3. Customization Workflow

**Q57**: Should there be an `npm run customize` script that prompts for project name, ports, etc.?
> **A**: Yes, add a setup script. Interactive prompt: project name, ports, org name. Renames everything automatically.

**Q58**: Would a simple sed-based rename script be more practical?
> **A**: Prefer an interactive prompt over raw sed (same as Q57).

---

## G. Meta-Process (8 questions)

### G1. Single-Session Implementation

**Q59**: Should there have been a review checkpoint between phases?
> **A**: Not relevant as a retrospective question. The issues need to be identified and fixed — that's what this review is for. Add any version/config issues to the to-do list.

**Q60**: Were the vitest version error (4.1.1 vs 4.0.18) and the ESLint peer dep issue caught quickly enough, or do they indicate insufficient pre-research?
> **A**: Same as Q59 — identify and fix, don't dwell on process.

### G2. Historical Analysis Utilization

**Q61**: Which specific findings from the external analysis made it into the template?
> **A**: The whole point of this Q&A and review process is that we will now go into the 5 reference projects and analyze them to make additional changes. This is the cleanup phase.

**Q62**: Which findings were noted as important but deferred? Were the deferral reasons valid?
> **A**: Same as Q61 — will be addressed in the investigation pass.

**Q63**: Is the gap between "what we learned" and "what we built" acceptable for a v0.1.0?
> **A**: Same as Q61.

### G3. Plan Fidelity

**Q64**: Did every verification step actually run?
> **A**: No strong opinion. The plan got us to the end point. We're now in the cleanup phase.

**Q65**: Were there any deviations from the plan? If so, were they improvements or compromises?
> **A**: Same as Q64.

**Q66**: Should the plan have included more specific acceptance criteria per file?
> **A**: Same as Q64.
