# IMPLEMENTATION_PLAN.md — AppyStack Wave 3

**Goal**: Test completeness, foundation fixes, and production pattern examples.
**Started**: 2026-02-26
**Target**: All test gaps closed. Code quality fixes applied. MSW, RHF+Zod form, and API wrapper patterns demonstrated in template.

## Summary
- Total: 16 | Complete: 16 | In Progress: 0 | Pending: 0 | Failed: 0

## Dependency Order

```
WU-1 (cleanup: fetch mock + placeholder)  ──┐
WU-2 (server path aliases)                 ├──▶ independent, run in parallel
WU-3 (TypeScript strictness options)       ──┘

WU-4 (test: logger.ts)           ──┐
WU-5 (test: main.tsx)            ├──▶ independent test additions
WU-6 (test: graceful shutdown)   ├
WU-7 (test: static file + SPA)   ├
WU-8 (test: env invalid vars)    ├
WU-9 (test: requestLogger levels)├
WU-10 (test: StatusDot + Socket) ──┘

WU-11 (E2E: socket ping-pong)    ─── independent, needs dev server running

WU-12 (socket auth example)      ─── tiny, independent

WU-13 (MSW setup example)        ─── independent, new dependency (msw)
WU-14 (RHF + Zod form example)   ─── independent, new dependencies (react-hook-form, zod already present)
WU-15 (API request wrapper)      ─── independent, no new dependencies
```

**Wave A** (parallel): WU-1, WU-2, WU-3
**Wave B** (parallel): WU-4, WU-5, WU-6, WU-7
**Wave C** (parallel): WU-8, WU-9, WU-10, WU-11
**Wave D** (parallel): WU-12, WU-13, WU-14, WU-15

---

## Pending

### Phase 1: Foundation Fixes

- [x] WU-1: cleanup — fix placeholder assertion + centralise fetch mock into test setup. Fetch mock centralised in setup.ts; beforeEach ordering (setup → file → describe) required nativeFetch capture at module-load time to avoid circular refs.
- [x] WU-2: server-path-aliases — added @routes, @middleware, @config, @services to server tsconfig. Required tsc-alias as post-build step (tsc does not rewrite alias paths in emitted JS; tsx handles them natively in dev).
- [x] WU-3: typescript-strictness — added noUncheckedIndexAccess, noPropertyAccessFromIndexSignature, noImplicitOverride to config/typescript/base.json. No errors surfaced — codebase was already clean.

### Phase 2: Test Completeness — Server

- [x] WU-4: test-logger — 3 tests. Cache-busting query strings on dynamic imports used to force module re-evaluation per test (same pattern as env.test.ts).
- [x] WU-5: test-main — 4 tests. Tested ErrorBoundary tree directly rather than importing main.tsx entry point (createRoot side-effect not testable in jsdom).
- [x] WU-6: test-shutdown — 3 tests. vi.spyOn(process, 'exit') + vi.spyOn(httpServer, 'close') with immediate callback invocation. process.emit('SIGTERM'/'SIGINT') triggers handlers.
- [x] WU-7: test-static — 9 tests. DISCOVERED BUG: app.get('*', ...) is Express 4 syntax — Express 5 requires app.get('*splat', ...). SPA fallback in index.ts has been silently broken in production. Added WU-7b to fix.
- [x] WU-7b: express5-wildcard-fix — app.get('*') → app.get('*splat'). Only one instance in codebase; static.test.ts already used *splat correctly.
- [x] WU-8: test-env-invalid — 2 tests added. try/catch required: mocked process.exit is a no-op so code continues to spread undefined parsed.data, throwing TypeError.

### Phase 3: Test Completeness — Client + Middleware

- [x] WU-9: test-request-logger — 4 tests. pino-http calls logger.child() then child[level]() — must spy on logger.child, not logger.info directly.
- [x] WU-10: test-components — +5 tests. StatusDot tested indirectly via StatusGrid (non-exported sub-component). SocketDemo button enabled state used as connection indicator.
- [x] WU-11: e2e-socket — 1 new E2E test. Button enabled state used as socket connection signal (text appeared twice causing strict mode violation).

### Phase 4: Production Pattern Examples

- [x] WU-12: socket-auth-example — commented JWT pattern added to index.ts socket handler.
- [x] WU-13: msw-setup — MSW files created (handlers, server, browser, example test). Agent got stuck on npm test due to MSW in global setup conflicting with vi.stubGlobal fetch. Fixed: MSW moved to opt-in per-test-file, not global. Also fixed EADDRINUSE: index.ts now guards listen with !env.isTest; app.test.ts starts server on port 0 in beforeAll.
- [x] WU-14: rhf-zod-form — ContactForm.tsx + ContactForm.test.tsx (8 tests). react-hook-form + @hookform/resolvers installed. ContactForm in LandingPage behind toggle.
- [x] WU-15: api-wrapper — client/src/utils/api.ts + api.test.ts (6 tests). Typed fetch wrapper with ApiError, get/post, AbortSignal support.

---

## In Progress

(coordinator moves items here with [~])

---

## Complete

(coordinator moves items here with [x] and outcome notes)

---

## Failed / Needs Retry

(coordinator moves items here with [!] and failure reason)

---

## Notes & Decisions

- **console.error in env.ts is intentional** — logger.ts imports env.ts, using logger there would create a circular dependency. Do not change console.error to logger.error in env.ts.
- **MSW install**: `npm install --save-dev msw` in template/client workspace only
- **react-hook-form install**: `npm install react-hook-form` + `npm install --save-dev @hookform/resolvers` in template/client workspace. Zod is already present in shared.
- **ContactForm purpose**: demonstrate the RHF + Zod pattern for consumers. It is NOT a real form — it's a copy-paste starting point. UI integration should be minimal (toggle section in LandingPage).
- **Socket auth example**: comment-only change. No real JWT implementation. Shows WHERE and HOW — pattern only.
- **TypeScript strictness**: after adding options to base.json, run typecheck across all workspaces. Fix any newly surfaced errors before marking complete.
