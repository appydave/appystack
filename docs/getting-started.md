# Getting Started with AppyStack

Two ways to create a new project from the AppyStack template. Both give you the same result — a complete, production-ready RVETS monorepo.

---

## Option A — GitHub Template

Best when you want a real GitHub repo for your project from the start.

### How it works

GitHub copies the entire `appystack` repository into a new repo under your account. You then work in the `template/` subdirectory as your project root.

### Steps

**1. Create your repo from the template**

Go to: https://github.com/appydave/appystack/generate

- Set the owner and repository name (e.g. `my-org/my-app`)
- Choose Public or Private
- Click **Create repository from template**

**2. Clone your new repo**

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

**3. Work inside `template/`**

The `template/` directory is your application root. All commands run from here:

```bash
cd template
npm install
```

**4. Customise**

```bash
npm run customize
```

This interactive script will ask for:
- Project name (e.g. `my-app`)
- Package scope (e.g. `@myorg`)
- Server port (default: 5501)
- Client port (default: 5500)
- Description

It rewrites all package names, ports, and references in one pass.

**5. Start developing**

```bash
npm run dev
```

Client runs at `http://localhost:YOUR_CLIENT_PORT`
Server runs at `http://localhost:YOUR_SERVER_PORT`

### Pros
- Full GitHub repo with history, issues, PRs, CI from day one
- The CI workflow (`.github/workflows/ci.yml`) is already included and will run automatically
- Easy to keep in sync with upstream AppyStack improvements via git

### Cons
- Requires a GitHub account
- Your project lives inside a subdirectory (`template/`) rather than at the repo root — you may want to restructure this after customisation

---

## Option B — degit

Best when you want a clean project folder with no connection to the AppyStack repo.

### How it works

`degit` downloads the contents of the `template/` subdirectory directly — no git history, no upstream connection, no GitHub account required.

### Steps

**1. Scaffold your project**

```bash
npx degit appydave/appystack/template my-new-app
```

Replace `my-new-app` with your project name.

**2. Install dependencies**

```bash
cd my-new-app
npm install
```

**3. Customise**

```bash
npm run customize
```

Same interactive script as Option A — updates all package names, ports, and references.

**4. Initialise git (optional)**

```bash
git init
git add .
git commit -m "feat: initial commit from AppyStack template"
```

**5. Start developing**

```bash
npm run dev
```

### Pros
- Zero git history — starts completely clean
- No GitHub account needed
- Project is at the root of your folder, not in a subdirectory
- No upstream connection — fully independent from day one

### Cons
- No automatic CI setup (you'll need to push to GitHub and add the workflow manually)
- No easy way to pull upstream AppyStack improvements later

---

## After Setup — What You Have

Whichever option you chose, you now have:

```
my-app/
├── client/          # React 19 + Vite 7 + TailwindCSS v4  →  :5500
├── server/          # Express 5 + Socket.io + Pino + Zod   →  :5501
├── shared/          # TypeScript interfaces shared by both
├── e2e/             # Playwright smoke tests
├── scripts/
│   └── customize.ts # Run again any time to rename things
├── .env.example     # Copy to .env and fill in values
├── Dockerfile       # Multi-stage production build
└── docker-compose.yml
```

### Key commands

| Command | What it does |
|---|---|
| `npm run dev` | Start client + server (hot reload) |
| `npm run build` | Build shared → server → client |
| `npm test` | Run all unit tests (81 tests) |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright smoke tests |
| `npm run lint` | ESLint across all workspaces |
| `npm run format` | Prettier across all workspaces |
| `npm run typecheck` | TypeScript check across all workspaces |
| `npm run customize` | Re-run the customisation script |

---

## Shared Config Package

AppyStack also publishes its tooling configs as a standalone npm package. If you want to use the same ESLint, TypeScript, Vitest, and Prettier settings in a project that isn't based on the template:

```bash
npm install --save-dev @appydave/appystack-config
```

See [npmjs.com/package/@appydave/appystack-config](https://www.npmjs.com/package/@appydave/appystack-config) for usage.
