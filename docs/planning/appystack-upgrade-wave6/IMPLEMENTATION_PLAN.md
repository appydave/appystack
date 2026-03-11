# IMPLEMENTATION_PLAN.md — AppyStack Upgrade Tool (Wave 6)

**Goal**: Build `npx appystack-upgrade` — a versioned, diff-aware CLI that pulls AppyStack template improvements into consumer apps without silently overwriting project-owned files.
**Started**: 2026-03-11
**Target**: Tool runs successfully against ThumbRack, DeckHand, and Signal Studio. Produces correct diff output, auto-updates safe files, skips project-owned files.

## Summary
- Total: 13 | Complete: 13 | In Progress: 0 | Pending: 0 | Failed: 0

## Pending

- [x] wu01-package-scaffold — Add `appystack-upgrade` bin entry to create-appystack/package.json; create bin/upgrade.js shell + bin/lib/ directory structure
- [x] wu02-version-detection — bin/lib/version.js: detect appystack.json → scan git log for scaffold patterns → prompt fallback → write appystack.json
- [x] wu03-template-source — bin/lib/template.js: resolve template dir (bundled or --template-path override); walk and return classified file list (108 files found)
- [x] wu04-file-classification — bin/lib/classify.js: `classifyFile(path) → 'auto' | 'never' | 'recipe'`; unknown paths default to 'never'
- [x] wu05-diff-engine — bin/lib/diff.js: `git diff <scaffoldCommit> -- <file>`; empty = auto-update; has diff = show + prompt [s]kip/[m]anual/[o]verwrite; writes UPGRADE_TODO.md
- [x] wu06-recipe-sync — bin/lib/recipe.js: new files → auto-add; SKILL.md → always diff; existing refs → standard diff engine
- [x] wu07-cli-orchestration — Wire lib/* into bin/upgrade.js main(); print summary table (updated / needs-merge / skipped / added)
- [x] wu08-create-appystack-update — Add appystack.json write to create-appystack scaffold step (bin/index.js); version from package.json
- [x] wu09-test-thumbrack — PASS with manual reverts: scope/port overwrite bug in env.ts, health.ts, info.ts, entitySocket.ts — all reverted before commit
- [x] wu10-test-deckhand — PASS with manual reverts: same 4-file overwrite bug — all reverted before commit
- [!] wu11-test-signal-studio — PARTIAL: prompt fallback + recipe sync worked correctly; BUT health.ts/info.ts/entitySocket.ts committed with wrong @appystack-template/shared scope — needs revert + reclassification fix
- [x] wu12-fix-classification — Reclassify env.ts, health.ts, info.ts, entitySocket.ts to 'never'; Signal Studio scope fixed; DeckHand re-run clean (83 owned, 24 updated)
- [x] wu13-docs — Update upgrade-strategy.md (status: implemented + known limitation); update root CLAUDE.md; update create-appystack/package.json keywords

## In Progress
(coordinator moves items here with [~])

## Complete
(coordinator moves items here with [x], adds outcome notes)

## Failed / Needs Retry
(coordinator moves items here with [!], adds failure reason)

## Notes & Decisions

### Architectural decisions (2026-03-11)
- **Two bins, one package**: `appystack-upgrade` added as second bin entry in `create-appystack/package.json` — shared template, shared deps, one publish cadence, zero new infrastructure
- **Version tracking via `appystack.json`**: `{ "version": "0.3.0", "scaffoldCommit": "abc123", "lastUpgrade": null }`
- **Scaffold commit detection patterns**: "initial scaffold from create-appystack", "scaffold appystack into existing project" — regex match on git log
- **Template source**: bundled in package (same pattern as create-appystack); `--template-path` flag for monorepo dev use
- **Full classification from day one**: recipe handling is a special case, not a separate MVP — same diff engine underneath
- **MVP scope**: all three tiers classified and handled; Signal Studio no-scaffold fallback included

### Test targets
- ThumbRack: `/Users/davidcruwys/dev/ad/apps/thumbrack` — purest case, true scaffold commit
- DeckHand: `/Users/davidcruwys/dev/ad/apps/deckhand` — retrofit scaffold commit
- Signal Studio: `/Users/davidcruwys/dev/clients/supportsignal/signal-studio` — no scaffold commit, prompt fallback

### Out of scope (this wave)
- FliHub, FliDeck, FliGen — adoption targets, no scaffold baseline, separate work stream
- Interactive merge tool — show diff + prompt is sufficient MVP; actual merge editor is follow-up
- Remote template fetch from npm registry — bundled template is sufficient for now
