# create-appystack

Scaffold a new [AppyStack](https://github.com/appydave/appystack) RVETS project in one command.

## Usage

```bash
npx create-appystack my-app
```

Or without a name (interactive):

```bash
npx create-appystack
```

The CLI will prompt for:

1. **Project name** — directory name and package name suffix
2. **Package scope** — npm scope (e.g. `@myorg`)
3. **Server port** — default `5501`
4. **Client port** — default `5500`
5. **Description** — short project description

Then it copies the template, applies your settings, runs `npm install`, and prints next steps.

## What You Get

A full-stack TypeScript monorepo with:

- **React 19 + Vite 7 + TailwindCSS v4** — client (your chosen port)
- **Express 5 + Socket.io + Pino + Zod** — server (your chosen port)
- **Shared TypeScript types** — workspace package
- **Vitest** — server + client tests
- **ESLint 9 flat config + Prettier** — via `@appydave/appystack-config`
- **Husky + lint-staged** — pre-commit hooks

## After Creation

```bash
cd my-app
npm run dev          # Start client + server concurrently
npm test             # Run all tests
npm run build        # Production build
npm run typecheck    # TypeScript check across all workspaces
```

## Upgrading to 0.5.0

**0.5.1** fixes 0.5.0 shipping a stale lockfile (new 0.5.0 apps failed `npm install` with `ERESOLVE`).

New apps now ship with quality gates that fail the build: spacing, Prettier, Oxlint, a ban on inline `eslint-disable` / `oxlint-disable` comments, size, magic numbers, complexity, duplicate code, root imports, dead code and cycles, and no re-exports. The rules and thresholds live in the app's `.oxlintrc.json`, `eslint.config.js`, `lint/`, `.jscpd*.json` and `.dependency-cruiser.cjs`; read those, not this page.

- **`npm run lint` will probably fail after `npx appystack-upgrade` on an existing app.** The gates are finding real issues in your code (a 0.4.18 app showed 164 ESLint + 37 Oxlint findings). `npm run lint:fix` clears the spacing ones; the rest are real fixes.
- If `npm install` fails with `ERESOLVE`, run `npm install --legacy-peer-deps` once. Later plain installs work.
- The upgrade overwrites `.oxlintrc.json` and the template-owned `lint/` rules, and adds the gate scripts and devDependencies to `package.json`. Values you already set there are kept; a customised `lint` script is left alone and listed in `UPGRADE_TODO.md`.

## Upgrading to 0.5.2

New apps now also enforce complexity limits, duplicate code, no `../` imports, dead code and import cycles, and no re-exports. `npm run dup` and `npm run deadcode` are new scripts; `npm run lint` and `npm test` cover the rest.

- **`AppError` moved.** Import it from `@helpers/AppError.js`; `errorHandler.js` no longer re-exports it. The template also dropped `AppContext` and `msw`.
- **Server aliases.** `npx appystack-upgrade` adds the `@config`, `@helpers` and `@test` aliases to `server/tsconfig.json` and `server/vitest.config.ts`, and carries the 0.5.x `lint` script across. Anything it cannot patch is listed in `UPGRADE_TODO.md`.
- **`--port` now rewrites `.vscode/launch.json`** as well as the app's config.
- **`--yes` and non-interactive runs** either create the app or exit with an error naming the missing flag. `--yes` defaults: scope `@myorg`, ports `5500` / `5501`, no GitHub repo; the app name has no default.
- **A 0.4.x app needs three packages added after the upgrade**, and `npx appystack-upgrade` lists the steps in `UPGRADE_TODO.md` when they are missing. The upgraded server code imports `@appydave/core`, which needs zod 4, and the client tests need `@testing-library/dom`. A plain install fails `ERESOLVE` on a 0.4.x lockfile, so use `--legacy-peer-deps` once:

  ```bash
  npm install -w server @appydave/core@^0.2.0 zod@^4 --legacy-peer-deps
  npm install -w client -D @testing-library/dom --legacy-peer-deps
  npm install            # plain installs work from here
  npm run build -w shared
  ```

  On a 0.4.18 app the server then booted and the zod 3 to 4 bump broke none of that app's own code; check yours. `npm run typecheck` still fails there (`errorHandler.test.ts`, TS2459 on `AppError`) until you apply the `AppError` import row in `UPGRADE_TODO.md`, after which it passes.

## Stack

**R**eact · **V**ite · **E**xpress · **T**ypeScript · **S**ocket.io

## License

MIT
