# BACKLOG.md

Tracked improvement ideas and deferred decisions for AppyStack. Not a sprint — just a place to capture things worth revisiting before they get lost.

---

## Wave 5 Candidates

### Docs
- **docs/README.md navigation** — Add task-based navigation ("I want to add a Socket.io event" → socket-io.md + api-design.md) and priority grouping ("Start here")
- **template/README.md** — Expand into a "welcome to your new project" guide. Currently thin. Should explain the demo/ folder, customization TODO markers, and first steps after cloning.

### Architecture Decisions (Open)
- **ShadCN/Radix question** — Template currently uses plain TailwindCSS. Decide: stay minimal, or add ShadCN as the default component library? Would affect template structure, dependencies, and the `cn()` utility already in place.

### Test Coverage Gaps
- **Component render tests** — `StatusGrid`, `TechStackDisplay`, `SocketDemo` in `client/src/demo/` have 35–50% branch coverage. No render tests exist. Adding tests for these before they're used as reference code would improve confidence.
- **E2E error scenarios** — Current E2E tests cover happy paths only. Missing: server-down (500), rate limiting (429), validation errors, Socket.io reconnection.
- **Middleware coverage** — Helmet security headers, compression, and CORS behaviour are untested. These are important for production apps built on the template.

### Config Package
- **Refactor check** — Confirm `react.config.js` extending `base.config.js` (done in review) hasn't introduced any edge case for projects that only use the react config entry point.
- **Version bump** — After any config changes, publish as `v1.0.4`.

---

## Deferred / Parked

- **Feature-based folder structure** — Some consumer apps may prefer `features/` over `components/pages/hooks/`. A guide or variant would be useful but is out of scope for the base template.
- **Authentication pattern** — JWT / session-based auth is a common first extension. A Wave N WU could add a commented auth scaffold (commented out by default).
- **Database integration guide** — Prisma or Drizzle as a first-class pattern. Not in scope until the base template is more stable.

---

*Last updated: 2026-02-27*
