# Plan: `npx create-appystack`

## Context

Setting up a new AppyStack project currently requires manually cloning the repo, copying the template, and running `npm run customize`. This friction stops developers from even trying it. The goal is a single command:

```bash
npx create-appystack my-app
```

That copies the template, walks through 5 prompts (app name, scope, ports, description), installs deps, and prints `cd my-app && npm run dev`.

The package name `create-appystack` is **available on npm**. The user is already logged in as `klueless-io` so publishing is fully automatable. I will pause once — before the actual `npm publish` — to show a dry-run and ask for the go-ahead.

---

## What Gets Built

### New directory: `create-appystack/`

```
create-appystack/
├── package.json        ← name: "create-appystack", bin: ./bin/index.js
├── bin/
│   └── index.js        ← the CLI (plain ESM JS, no build step)
├── template/           ← committed copy of ../template/ (without node_modules, test-results, coverage)
└── README.md
```

### Relationship to existing `template/`

`template/` at the repo root stays the source of truth for development and docs. `create-appystack/template/` is a committed copy. A `sync` script in `create-appystack/package.json` copies root → package when the template changes.

---

## Step-by-Step Plan

### Step 1 — Create `create-appystack/package.json`

```json
{
  "name": "create-appystack",
  "version": "0.1.0",
  "description": "Scaffold a new AppyStack RVETS project — React, Vite, Express, TypeScript, Socket.io",
  "type": "module",
  "bin": { "create-appystack": "./bin/index.js" },
  "files": ["bin/", "template/"],
  "scripts": {
    "sync": "node scripts/sync-template.js",
    "prepublishOnly": "node scripts/sync-template.js"
  },
  "dependencies": {
    "@clack/prompts": "^1.0.1"
  },
  "engines": { "node": ">=18" },
  "author": "David Cruwys",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/appydave/appystack"
  },
  "keywords": ["appystack", "create", "scaffold", "react", "vite", "express", "typescript", "socket.io"]
}
```

### Step 2 — Write `create-appystack/scripts/sync-template.js`

Copies `../template/` → `./template/` excluding `node_modules`, `dist`, `coverage`, `test-results`, `.git`. Uses Node `fs` only — no external deps. Runs as `prepublishOnly` so template is always fresh at publish time.

### Step 3 — Copy template files now

Run `sync-template.js` immediately to populate `create-appystack/template/` and commit it.

### Step 4 — Write `create-appystack/bin/index.js`

The CLI — plain ESM, no TypeScript, no build step. Logic ported directly from `template/scripts/customize.ts`.

**Flow:**
1. Read optional `process.argv[2]` as project name (if provided, skip the name prompt)
2. Check target directory doesn't already exist (error clearly if it does)
3. Run 5 `@clack/prompts` prompts: project name, package scope, server port (default 5501), client port (default 5500), description
4. Copy `../template/` to `./{projectName}/` using `fs.cpSync`
5. Apply same 8-file replacements as `customize.ts` (package.json files, .env.example, env.ts, vite.config.ts, index.html)
6. Run `npm install` in the new dir via `execSync` with `stdio: 'inherit'`
7. Print success:
   ```
   ✔ Created my-app

   Next steps:
     cd my-app
     npm run dev

   Client: http://localhost:5500
   Server: http://localhost:5501
   ```

**Error handling:** wrap in try/catch, show clear messages for: dir exists, npm install fails, prompt cancelled.

### Step 5 — Test locally (before touching npm)

```bash
cd create-appystack
node bin/index.js test-project-123
# verify test-project-123/ created, customized, npm installed
# verify: cd test-project-123 && npm run dev works
rm -rf test-project-123/
```

### Step 6 — Dry run

```bash
cd create-appystack
npm publish --dry-run
```

Show output to user. **Pause here.** Ask: "dry run looks good — shall I publish?"

### Step 7 — Publish (with user approval)

```bash
cd create-appystack
npm publish --access public
```

Verify with: `npm view create-appystack`

### Step 8 — Test from npm

```bash
npx create-appystack@latest my-live-test
rm -rf my-live-test/
```

### Step 9 — Commit everything

Commit `create-appystack/` to main.

---

## Files Created / Modified

| File | Action |
|------|--------|
| `create-appystack/package.json` | Create |
| `create-appystack/bin/index.js` | Create |
| `create-appystack/scripts/sync-template.js` | Create |
| `create-appystack/template/` | Create (synced copy) |
| `create-appystack/README.md` | Create |

No existing files are modified.

---

## Human-in-the-Loop Moment

**One pause only:** After `npm publish --dry-run` (Step 6). I'll show the dry-run output and ask "shall I publish?". Everything else — building, syncing, local testing, the dry run, and the actual publish after approval — is automated.

---

## Verification

```bash
# After publish:
npx create-appystack my-test-app
cd my-test-app
npm run dev
# → Client at http://localhost:5500 should load AppyStack landing page
# → Server at http://localhost:5501/health should return { status: "ok" }
```
