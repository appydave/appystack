---
generated: 2026-04-05
generator: system-context
status: snapshot
sources:
  - CLAUDE.md
  - BACKLOG.md
  - config/package.json
  - create-appystack/package.json
  - create-appystack/bin/index.js
  - create-appystack/bin/upgrade.js
  - template/CLAUDE.md
  - template/server/src/config/env.ts
  - template/.claude/skills/recipe/SKILL.md
  - template/.claude/skills/app-idea/SKILL.md
  - docs/architecture.md
regenerate: "Run /system-context in the repo root"
---

# AppyStack — System Context

## Purpose
Shared config package and scaffolding CLI for the RVETS stack (React 19, Vite 7, Express 5, TypeScript, Socket.io), ensuring every new full-stack app starts with identical architecture, linting, testing, real-time wiring, and Claude Code skills from commit zero — and can pull in template improvements later via `npx appystack-upgrade`.

## Core Abstractions
- **RVETS Stack** — The specific technology combination this project standardises: React 19 + Vite 7 + Express 5 + TypeScript + Socket.io. Every config and template decision flows from this choice. The stack is opinionated by design: real-time from day one, Zod for env validation, Pino for logging, ESLint 9 flat config, Overmind for process management.
- **Config Package** (`@appydave/appystack-config`) — Shared ESLint 9, TypeScript, Vitest, and Prettier configs that downstream apps extend in 1–3 lines each. Published separately from the CLI. Consumer projects reference it as a peer dependency; upgrading the config package upgrades lint/typecheck rules across all apps at once.
- **Template** — The canonical scaffold at `template/` (root). Every consumer project starts as an exact copy, customised via string replacement for name/scope/ports. It is committed here and synced into `create-appystack/template/` before publish. It includes the full skill system as `.claude/skills/` (recipe, app-idea, mochaccino).
- **Recipes** — Claude Code skill specs bundled into the template at `.claude/skills/recipe/`. Each recipe (nav-shell, file-crud, entity-socket-crud, add-auth, add-sync, etc.) is an architecture pattern that Claude scaffolds into a running project. They are composable and idempotent, framed as "capability descriptions" rather than programs. They only function inside a scaffolded app, not from this repo.
- **Upgrade System** (`appystack-upgrade`) — A second CLI bin that runs inside existing consumer apps. It walks template files, classifies each as `auto` (safe overwrite), `recipe` (skill file, prompts before merging), `never` (owned by developer), or `owned` (project-specific). It uses `appystack.json` (written at scaffold time) as a version baseline to determine which updates are new since the last upgrade.

## Key Workflows

### Scaffolding a new app (developer intent → running project)
1. Developer runs `npx create-appystack@latest my-app` (or with `--scope`, `--port`, `--description` flags).
2. CLI prompts for project name, package scope, client port, server port, description, and optional GitHub org.
3. CLI copies `template/` to a new directory, applies string replacement (scope, ports, description, title) across package.json files, `.env.example`, `vite.config.ts`, `server/src/config/env.ts`, `client/index.html`, `README.md`, and all `.ts/.tsx` imports.
4. CLI runs `npm install`, `git init && git add -A && git commit`, optionally creates and pushes a GitHub repo via `gh`.
5. Writes `appystack.json` at the project root recording the CLI version and scaffold commit SHA — the upgrade baseline.
6. Developer `cd`s into the project, runs `cp .env.example .env`, then `./scripts/start.sh` (Overmind-based).

### Pulling in template updates (upgrading an existing app)
1. Developer runs `npx appystack-upgrade` from inside their consumer app.
2. CLI reads `appystack.json` to determine the scaffold version and commit.
3. CLI walks every template file and classifies it: `auto` (CI, config, middleware) → auto-applies if the file hasn't diverged; `recipe` (skill files) → shows a diff and prompts; `never` (app-specific code) → left alone.
4. Updates `appystack.json` with `lastUpgrade` date.
5. Any files requiring manual attention are listed in `UPGRADE_TODO.md`.

### Adding a feature to a consumer app (recipe workflow)
1. Developer says `/recipe` in Claude Code inside a scaffolded project.
2. Recipe skill lists available patterns (nav-shell, file-crud, add-auth, wizard-shell, add-sync, etc.).
3. For `file-crud`: checks if an existing domain DSL matches; if not, collects entity details.
4. Skill generates a concrete build prompt with specific file names, component names, event names — not generic descriptions.
5. Developer confirms; Claude builds the feature following the reference spec.

### Managing feature ideas (app-idea workflow)
1. Developer or stakeholder says `/app-idea` in Claude Code inside a scaffolded project.
2. Skill checks for `app-idea/index.json` at the project root; scaffolds it on first use.
3. **Capture**: zero-friction intake — Claude asks what the idea is, assigns an ID, writes `app-idea/NNN.md` and updates `index.json`.
4. **Triage**: walk open items, classify each as FR or BUG, assign appetite (small/medium/large), accept/defer/reject with reasoning.
5. **Status**: dashboard view with counts by state (open, triaged, in-progress, done).
6. **Close**: mark in-progress items as done with outcome notes.

### Publishing config or CLI updates (maintainer workflow)
1. Make changes to `template/` (root) or `config/`.
2. For CLI: `cd create-appystack && npm publish --access public` (`prepublishOnly` auto-syncs template).
3. For config: `cd config && npm publish --access public`.
4. Both packages are independent — publish only what changed.

## Design Decisions
- **String replacement over a templating engine**: The CLI uses `content.split(from).join(to)` to replace placeholder values (scope, ports, description) in template files. Simple, zero-dependencies, and easy to audit. The tradeoff: if placeholder strings change between template versions, upgrade code must keep pace.
  - *Alternative considered*: Mustache / Handlebars / EJS templates
  - *Why rejected*: Adds a runtime dependency; requires all template files to be valid template syntax; harder to read the template as a real project; the small number of substitution points doesn't justify the overhead.
- **Two separate npm packages**: `create-appystack` (CLI) and `@appydave/appystack-config` (shared configs) are published independently. A config fix doesn't require re-publishing the CLI, and vice versa.
  - *Alternative considered*: Single monorepo package with everything bundled
  - *Why rejected*: Config upgrades are frequent (lint rule changes, TS strictness bumps); CLI upgrades are rare. Coupling them forces unnecessary version bumps.
- **File classification tiers in upgrade**: The upgrade CLI categorises every template file as auto/recipe/never/owned rather than prompting on every file or blindly overwriting. This makes upgrades safe: app code is never touched, config improvements land automatically, skill files get a diff-and-confirm flow.
  - *Alternative considered*: Prompt on every changed file (like `degit --force`)
  - *Why rejected*: Prohibitively noisy for large templates; developers stop paying attention and either accept or skip everything blindly.
- **Data directory at monorepo root, not in `server/src/`**: Runtime-written JSON files live at `<project-root>/data/`, not inside any package. Nodemon watches `server/src/**/*.ts` for code changes; writing data files there would trigger server restarts on every write, causing `EADDRINUSE` crashes.
  - *Alternative considered*: `server/data/` (co-located with the server)
  - *Why rejected*: Still inside nodemon's process tree; any watch glob that covers `server/` would catch it.
- **Overmind for process management**: `./scripts/start.sh` uses Overmind to launch client and server as managed processes. Overmind provides attach/detach, individual restarts, and survives terminal close.
  - *Alternative considered*: `concurrently` npm package (used earlier)
  - *Why rejected*: No attach/detach, no individual process restart, dies when the terminal closes, log interleaving.
- **Skills bundled into the template**: Recipe, app-idea, and mochaccino skills ship inside the template at `.claude/skills/`. They become part of every scaffolded project. This means consumer apps get Claude Code capabilities out of the box without extra setup.
  - *Alternative considered*: Skills as a separate installable package
  - *Why rejected*: Skills need project context (file structure, types, routes) to work correctly. Shipping them in the template means they are always co-located with the code they need to read.

## Non-obvious Constraints
- **`dotenv.config()` needs explicit path and override**: When Overmind launches the server via `npm run dev -w server`, `process.cwd()` is `server/`. The template uses `dotenv.config({ path: path.resolve(process.cwd(), '..', '.env'), override: true })` — the `override: true` is critical because stale `PORT` values from prior shell sessions would otherwise silently win over `.env` values.
- **`VITE_SOCKET_URL` is not replaced during scaffolding** (open bug): `applyCustomizations` in the CLI replaces `PORT` and `CLIENT_URL` in `.env.example` but misses `VITE_SOCKET_URL=http://localhost:5501`. Every generated project with non-default ports has the wrong socket URL hardcoded. Socket.io silently fails to connect — UI shows "Loading..." indefinitely with no error.
- **`.env` is not auto-created from `.env.example`** (open bug): The CLI copies `.env.example` but does not create `.env`. `start.sh` fails if `.env` is absent. Developer must manually run `cp .env.example .env` before the first start — no prompt or error message guides them.
- **ESLint 9 silently ignores legacy config files**: If a consumer app has a `.eslintrc.*` or `eslint.config.cjs` file alongside the ESLint 9 flat config, ESLint 9 silently ignores the legacy file. No warning, no error — just different rules than expected.
- **TailwindCSS v4 syntax is incompatible with v3 directives**: The template uses `@import "tailwindcss"` and `@source` directives. Using `@tailwind base`, `@tailwind components`, `@tailwind utilities` (v3 syntax) produces no output silently in v4.
- **Recipes only work inside scaffolded projects**: The recipe skill ships inside the template at `.claude/skills/recipe/SKILL.md`. It does not exist in this repo's own `.claude/` folder. Running `/recipe` from inside the AppyStack repo itself will not find it.
- **Template sync is automatic on publish but not on local testing**: `prepublishOnly` runs `npm run sync` before `npm publish`, but local testing via `node bin/index.js` uses whatever is in `create-appystack/template/` — which may be stale if you edited root `template/` without syncing.
- **`start.sh` does not self-recover from stale Overmind state** (open bug): If `.overmind.sock` exists from a crashed session, `start.sh` cannot start cleanly. Manual `overmind stop && rm -f .overmind.sock` is required.

## Expert Mental Model
- **This repo produces applications; it does not run as one**: There is no `npm run dev` here that starts a server. The template is the product. Working in this repo means editing the template (which all future scaffolded apps will use), the config package (which all consumer apps extend), or the CLI (which produces those apps). The feedback loop for template changes is: edit → sync → scaffold a test app → verify.
- **Recipes are intelligence, not just code generation**: A recipe isn't a code generator that spits out files — it's a specification of how a class of app should be structured. When Claude runs `/recipe file-crud`, it reads the reference spec, understands the project's existing structure, and generates code that fits. The reference file in `.claude/skills/recipe/references/` is the contract. An expert treats the reference file as the source of truth for what the recipe will build, not the generated output.
- **The upgrade tier system is the safe upgrade guarantee**: The `auto/recipe/never/owned` classification is what makes `npx appystack-upgrade` safe to run on a production codebase. An expert knows which tier each file falls into before running the upgrade. Config files and CI are `auto` — they land silently. Skill files are `recipe` — they show a diff. App code (`client/src/`, `server/src/`) is `never` — it is never touched.
- **Skills form a layered workflow**: Recipe builds features, mochaccino explores UI before building, app-idea captures and triages what to build next. An expert uses all three in sequence: app-idea to decide what to build, mochaccino to explore how it should look, recipe to scaffold the implementation. Each skill has a different actor model — app-idea serves stakeholders, mochaccino serves designers, recipe serves developers.
- **Port conflicts are a class of bugs, not one-off incidents**: The BACKLOG documents multiple port-related failure modes (dotenv not finding `.env`, `start.sh` not self-recovering, stale shell env overriding `.env`). An expert checks the port registry before assigning any port, and treats silent port mismatches as a first hypothesis when Socket.io fails to connect.

## Scope Limits
- Does NOT include a database — ships with JSON file-based persistence at `data/`; database integration is per-project via the `add-orm` recipe (Prisma or Drizzle).
- Does NOT include authentication by default — available as the `add-auth` recipe (JWT + protected routes + optional Socket.io auth).
- Does NOT include deployment infrastructure beyond a Dockerfile and Procfile — no Terraform, no hosting config, no managed CI beyond the bundled GitHub Actions workflow.
- Does NOT maintain a live link to consumer apps — once scaffolded, projects evolve independently; AppyStack cannot push changes to them, only `npx appystack-upgrade` can pull.
- Does NOT include state management — consumer apps choose Zustand, Redux, TanStack Query, or React Context; the `add-state` recipe adds Zustand.
- Does NOT run as a dev server itself — there is nothing to start in this repo; the template is the artifact.

## Failure Modes
- **Silent wrong-port startup**: Server starts on the Zod schema default (5501) instead of the `.env` value. Root cause: `dotenv.config()` without correct `path` or `override: true` can't find or apply `.env` when `cwd` is `server/`. Symptom: client connects to the right port but server isn't there; Socket.io shows "Loading..." forever. The template fix is in place (`env.ts` line 5), but consumer apps scaffolded before this fix may still have the old code.
- **Socket.io never connects after scaffold with non-default ports**: `VITE_SOCKET_URL` in `.env.example` still has `5501` regardless of what port was entered during scaffold (open bug in CLI). Symptom: UI stuck on "Loading...", no error, DevTools shows WebSocket connecting to wrong port. Workaround: manually edit `VITE_SOCKET_URL` in `.env`.
- **`start.sh` gets stuck with stale Overmind state**: If a prior session crashed or was killed, `.overmind.sock` persists. `start.sh` cannot start Overmind on top of the stale socket. Running `overmind stop` on a stale sock produces confusing errors. Fix: manually `rm -f .overmind.sock` before starting.
- **Stale shell env overrides `.env`**: If a prior session left `PORT=5171` in the shell environment, `dotenv` without `override: true` will not overwrite it. Server runs on 5171 while the client proxy points to the `.env` port. The template now uses `override: true`, but consumer apps scaffolded before this fix need manual backporting.
- **Template sync forgotten before local testing**: Root `template/` is the canonical source. `create-appystack/template/` is a committed copy that `prepublishOnly` syncs automatically on publish. But local testing via `node bin/index.js` uses the potentially stale copy. Symptom: "I just changed the template but the scaffolded project doesn't have my change." Fix: `cd create-appystack && npm run sync`.
- **No UI signal when Socket.io fails to connect**: `useSocket` never surfaces connection errors. Any view waiting on socket data shows "Loading..." with no timeout, no retry indicator, no error message. The developer has no UI signal that the problem is server-side.
