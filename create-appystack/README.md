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

## Stack

**R**eact · **V**ite · **E**xpress · **T**ypeScript · **S**ocket.io

## License

MIT
