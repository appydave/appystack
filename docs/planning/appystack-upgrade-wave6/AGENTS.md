# AGENTS.md — AppyStack Upgrade Tool (Wave 6)

Operational knowledge for every agent in this campaign. Self-contained — each agent receives this file + their work unit prompt only.

---

## Project Overview

**Repo**: `/Users/davidcruwys/dev/ad/apps/appystack`
**Campaign**: `appystack-upgrade-wave6` — build `npx appystack-upgrade`
**Stack**: Plain ESM Node.js CLI (no build step), same pattern as `create-appystack`
**New package location**: `appystack-upgrade/` at repo root (sibling to `create-appystack/`, `config/`, `template/`)

### What we're building

A CLI that consumer apps run to pull AppyStack template improvements in. Works like `nx migrate latest`:
1. Detects what AppyStack version the app was scaffolded from
2. Compares consumer app files against the latest template
3. Auto-updates files the project hasn't touched (safe)
4. Shows diffs and prompts for files the project has customised (never silent overwrite)
5. Special handling for recipe files (new = auto-add, SKILL.md = always diff)

---

## Repo Structure

```
appystack/
├── create-appystack/           ← EXTEND THIS (add second bin + lib/)
│   ├── package.json            ← add "appystack-upgrade": "bin/upgrade.js" to bin{}
│   ├── bin/
│   │   ├── index.js            ← existing scaffold CLI — study this, do not modify (except wu08)
│   │   ├── upgrade.js          ← BUILD THIS — new upgrade CLI entry point
│   │   └── lib/                ← BUILD THIS — shared helper modules
│   │       ├── version.js      ← WU02: appystack.json detection + write
│   │       ├── template.js     ← WU03: template dir resolution + file walking
│   │       ├── classify.js     ← WU04: classifyFile() function
│   │       ├── diff.js         ← WU05: diff engine + UPGRADE_TODO.md writer
│   │       └── recipe.js       ← WU06: recipe-specific sync logic
│   ├── scripts/
│   │   └── sync-template.js    ← existing — no changes needed
│   └── template/               ← existing bundled template — source of truth for comparisons
├── template/                   ← root template (sync source) — read-only for upgrade tool
└── docs/planning/appystack-upgrade-wave6/   ← campaign artifacts
```

---

## Build & Run

```bash
# From repo root — install deps for new package (after wu01)
cd /Users/davidcruwys/dev/ad/apps/appystack/appystack-upgrade
npm install

# Run locally against a test app
node bin/index.js                          # interactive
node bin/index.js --template-path ../template  # dev mode: use local template

# Sync template into package (run after template changes)
npm run sync

# Test against the three target apps
node /path/to/appystack-upgrade/bin/index.js  # run from inside consumer app dir
```

---

## Key Conventions (inherited from create-appystack)

Study `create-appystack/bin/index.js` before writing any code. The upgrade CLI follows the same patterns:

- **Plain ESM** — `type: "module"` in package.json, `import` not `require`, no build step
- **`@clack/prompts`** for interactive UX — `intro`, `outro`, `text`, `select`, `confirm`, `spinner`, `note`, `isCancel`, `cancel`
- **`node:fs`** — `readFileSync`, `writeFileSync`, `existsSync`, `readdirSync`, `statSync`, `cpSync`
- **`node:path`** — `resolve`, `dirname`, `join`
- **`node:child_process`** — `execSync` for git commands, wrapped in `tryExec` helper
- **`fileURLToPath(import.meta.url)`** — for `__dirname` equivalent in ESM
- **No external deps except `@clack/prompts`** — keep it minimal

```js
// Standard ESM __dirname pattern
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
```

---

## appystack.json Schema

Written to the root of every consumer app after first upgrade run. Also written by `create-appystack` at scaffold time (wu08).

```json
{
  "version": "0.3.0",
  "scaffoldCommit": "abc1234",
  "lastUpgrade": "2026-03-11",
  "templatePath": null
}
```

- `version` — AppyStack template version this app was scaffolded from (or last upgraded to)
- `scaffoldCommit` — git SHA of the scaffold commit (the git anchor for diff comparisons)
- `lastUpgrade` — ISO date of last `npx appystack-upgrade` run, null if never run
- `templatePath` — null (use bundled template) or absolute path (local dev override via `--template-path`)

---

## Scaffold Commit Detection

When `appystack.json` is absent, scan git log for these exact message patterns:

```js
const SCAFFOLD_PATTERNS = [
  'chore: initial scaffold from create-appystack',
  'chore: scaffold appystack into existing project',
];

// Run from within the consumer app directory:
// git log --oneline --all
// Match any commit message that includes one of the patterns above
```

**Known test cases**:
- ThumbRack: `"chore: initial scaffold from create-appystack"` — true scaffold
- DeckHand: `"chore: scaffold appystack into existing project"` — merge-mode scaffold
- Signal Studio: no scaffold commit — must prompt user

**Version inference**: if scaffold commit found but version unknown, check the commit date against known template release dates, or default to `"0.3.0"` (current stable) and log a warning.

---

## File Classification

```js
// Returns: 'auto' | 'never' | 'recipe'
function classifyFile(relativePath) { ... }
```

### `'auto'` — safe to overwrite if file unchanged since scaffold

```
server/src/middleware/errorHandler.ts
server/src/middleware/rateLimiter.ts
server/src/middleware/requestLogger.ts
server/src/middleware/validate.ts
server/src/routes/health.ts
server/src/routes/info.ts
server/src/config/env.ts          ← auto ONLY if no custom vars added
server/src/config/logger.ts
client/src/hooks/useSocket.ts
client/src/lib/entitySocket.ts
.github/workflows/ci.yml
eslint.config.js
```

### `'never'` — skip entirely, project owns these

```
package.json  (root + client/ + server/ + shared/)
shared/src/types.ts
shared/src/index.ts
server/src/index.ts
server/src/routes/  (except health.ts and info.ts)
client/src/  (pages/, components/, hooks/ except useSocket.ts)
.env
.env.example
CLAUDE.md
README.md
client/index.html
client/vite.config.ts
server/nodemon.json
tsconfig*.json  (consumer may have extended)
```

### `'recipe'` — special handling (see recipe logic below)

```
.claude/skills/recipe/SKILL.md                    ← always diff before overwrite
.claude/skills/recipe/references/*.md             ← auto if unchanged; new files auto-add
.claude/skills/recipe/domains/*.md                ← auto if unchanged
```

**Default for unknown paths**: `'never'` — safe fallback, never auto-update something unclassified.

---

## Diff Engine Logic

Core of the tool. For each file being considered for update:

```js
// 1. Check if file exists in consumer app
// 2. If not: auto-add (it's net-new)
// 3. If exists: run git diff against scaffold commit
//    execSync(`git diff ${scaffoldCommit} -- ${relativePath}`, { cwd: consumerAppDir })
// 4. Empty diff output → file unchanged since scaffold → auto-update safely
// 5. Non-empty diff → file has been customised → show diff + prompt
```

**Prompt for modified files**:
```
File modified since scaffold: server/src/middleware/requestLogger.ts
[show diff here using unified diff format]

What would you like to do?
  > [s] Skip — keep your version
    [o] Overwrite — replace with latest AppyStack version
    [m] Mark for manual merge — I'll update it myself later
```

Mark-for-manual-merge output: append to a `UPGRADE_TODO.md` file in the consumer app root listing files that need manual attention.

---

## Recipe Sync Logic

Recipe files use the diff engine but with these rules on top:

1. **New recipe reference files** (exist in template, not in consumer app) → **auto-add, no prompt**
2. **SKILL.md** → **always show diff even if unchanged** — it may have project additions we don't want to clobber
3. **Existing recipe reference files** → **use standard diff engine** (auto if unchanged, prompt if modified)
4. **Domain sample files** → **use standard diff engine**

```js
function handleRecipeFile(relativePath, scaffoldCommit, consumerDir, templateDir) {
  const inConsumer = existsSync(join(consumerDir, relativePath));
  if (!inConsumer) {
    // Auto-add: copy from template, log "Added: <path>"
    return 'added';
  }
  if (relativePath.endsWith('SKILL.md')) {
    // Always diff, always prompt regardless of git diff result
    return promptForMerge(relativePath, ...);
  }
  // Standard diff engine for all other recipe files
  return diffAndPromptIfModified(relativePath, ...);
}
```

---

## CLI Flow (main orchestration)

```
1. intro('appystack-upgrade')
2. Detect --template-path flag or use bundled template/
3. Load or detect appystack.json (version detection flow)
4. Collect all template files (walk template dir)
5. For each file:
   a. classifyFile(path)
   b. 'never' → skip (log "Skipped (project-owned): <path>")
   c. 'auto' → diff engine → auto-update or prompt
   d. 'recipe' → recipe sync logic
6. Write/update appystack.json with lastUpgrade date
7. Print summary table:
   ✔ 8 files updated automatically
   ⚠ 3 files need manual merge (see UPGRADE_TODO.md)
   — 12 files skipped (project-owned)
8. outro()
```

---

## Test Targets

Run the tool manually against each app. Expected outcomes:

### ThumbRack — `/Users/davidcruwys/dev/ad/apps/thumbrack`
- Should auto-detect scaffold commit from git log
- appystack.json should be created with version 0.3.0 and detected SHA
- Recipe files: check which ones ThumbRack is missing (new ones should auto-add)

### DeckHand — `/Users/davidcruwys/dev/ad/apps/deckhand`
- Scaffold commit message: "scaffold appystack into existing project"
- Same flow as ThumbRack but different commit pattern

### Signal Studio — `/Users/davidcruwys/dev/clients/supportsignal/signal-studio`
- No scaffold commit → prompt fallback
- User enters version manually → appystack.json written
- Recipe sync: Signal Studio has recipes — verify existing ones diff correctly, new ones auto-add

---

## Quality Gates

Before marking any work unit complete:

- [ ] `node bin/index.js --help` (or `--version`) exits cleanly — no uncaught errors
- [ ] No `any` JS — even plain ESM should be clean and readable
- [ ] `@clack/prompts` cancel handling on every prompt (check `isCancel(result)`)
- [ ] `tryExec` wrapping on every `execSync` call — never let git errors crash the CLI
- [ ] Commit with descriptive message after each successful work unit
- [ ] For test WUs: run the tool against the target app and capture actual output

---

## Anti-Patterns to Avoid

- **Never `execSync` without try/catch** — git commands can fail (no git, no commits, etc.)
- **Never silently overwrite** a file classified as `'never'` or that has a non-empty git diff without prompting
- **Never assume scaffold commit exists** — Signal Studio proves this fails; always have a fallback
- **Never walk into `node_modules`** — always exclude from directory walks
- **Don't use `@clack/prompts` outside the main async function** — wrap everything in `async main()`
- **Don't bundle heavy deps** — this is a lightweight CLI, not an app

---

## Inherited Learnings (from previous waves)

- Husky breaks in nested template dirs — do NOT use worktrees for this campaign (main branch only)
- create-appystack uses `tryExec` wrapper for all shell commands — copy this pattern exactly
- ESM `__dirname` requires `fileURLToPath(import.meta.url)` — don't forget this
- Scaffold commit messages are the canonical source of truth for version anchoring
- `cpSync` with `{ recursive: true, filter: fn }` is the right pattern for template file copying

## Wave 6 Learnings (appystack-upgrade-wave6)

- **Classify conservatively** — files with project-specific values at scaffold time (`env.ts`, `health.ts`, `info.ts`, `entitySocket.ts`) must be `'never'`. The git-diff approach cannot distinguish "customized at scaffold" from "never customized".
- **Template placeholder grep** — always run `grep -r "@appystack-template" server/ client/` before committing any upgrade test result. The placeholder scope propagates silently.
- **`--yes` mode** — `text()` returns `initialValue`, `select()` returns `'skip'`. Correct safe defaults.
- **Dependency injection for prompts** — pass `@clack/prompts` and sibling modules as params, not direct imports. Keeps modules testable without interactive terminal.
- **Test variety matters** — true scaffold + retrofit + hand-migrated gave 3 different failure modes. Unit tests would not have found the retrofit bug.
- **Fix WU pattern** — adding a fix WU mid-campaign (`[!]` item → new WU) is clean and works well.
