# Spaghetti gates: parked (2026-10-29)

AppyStack's "born gate-clean" work is **parked**. David's call: it resumes after the game's spaghetti
run finishes, and it then runs **on the M2 Spaghetti rig**, not as a single session.

**Read first when resuming:** `/Users/davidcruwys/dev/ad/brains/openrig/appystack-rig-parked-2026-10-29.md`.
That file is canonical and has the M2 state, the steps to take before the rig starts, and the lessons.
This file only records what is in this repo.

## In this repo

- **Landed on `main`:** `27ad3bd` (G00p, fail-fast `onListenError`, no more `kill -9`) and `7c43d6a`
  (G00a/G00b/G01: CI runs format, coverage and e2e; tests hit the real modules). Don't redo them.
- **Step 3 (tooling) is parked on branch `spaghetti/step3-wip`** (`49b9032`): `template/lint/`,
  the oxlint, stylelint, jscpd, knip and dependency-cruiser configs, the root `tsconfig.json`, and new
  devDeps. It is not green and not merged. Hooks, npm scripts, test-trust and the ESLint wiring are
  still to do.
- **Before merging it:** `oxlint-plugin-anti-slop` builds itself with pnpm on install, and a local
  lockfile resolved it as `git+ssh://`. Add a pnpm install before `npm ci` in both
  `.github/workflows/ci.yml` and `template/.github/workflows/ci.yml`, or CI goes red.
- **The M2's run worktree** (`.claude/worktrees/spaghetti`, branch `spaghetti/base`) is at `86ed309`,
  which is from before both commits above. Rebase or recreate it on `main` first.
