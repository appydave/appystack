# Assessment: appystack-upgrade-wave6

**Campaign**: appystack-upgrade-wave6
**Date**: 2026-03-11 → 2026-03-11 (single session)
**Results**: 13 complete, 0 failed

---

## Results Summary

| WU | Description | Outcome |
|----|-------------|---------|
| WU01 | Package scaffold (bin entry + lib/ structure) | ✔ Clean |
| WU02 | Version detection (appystack.json + git log) | ✔ Clean |
| WU03 | Template file walker (108 files found) | ✔ Clean |
| WU04 | File classification (auto/never/recipe) | ✔ Clean |
| WU05 | Diff engine (git diff + prompt + UPGRADE_TODO.md) | ✔ Clean |
| WU06 | Recipe sync (auto-add new, always-diff SKILL.md) | ✔ Clean |
| WU07 | CLI orchestration (self-verified against ThumbRack) | ✔ Clean |
| WU08 | create-appystack writes appystack.json at scaffold | ✔ Clean |
| WU09 | Test: ThumbRack | ✔ Pass (manual reverts before commit) |
| WU10 | Test: DeckHand | ✔ Pass (manual reverts before commit) |
| WU11 | Test: Signal Studio | ✔ Pass (scope bug caught post-commit, fixed in WU12) |
| WU12 | Fix classification + revert Signal Studio | ✔ Clean |
| WU13 | Docs (upgrade-strategy.md, CLAUDE.md, package.json) | ✔ Clean |

---

## What Worked Well

1. **Two-bins-one-package architecture** — zero new infrastructure, zero extra publish workflow. `appystack-upgrade` bin in `create-appystack/package.json` was the right call.
2. **Dependency injection for prompts** — passing `@clack/prompts` and `diffModule` as parameters to `handleAutoFile` and `handleRecipeFile` kept the lib/ modules fully testable without interactive terminal dependencies.
3. **Three-stage version detection** — `file → git → prompt` chain worked correctly across all three test cases: ThumbRack (git), DeckHand (git, retrofit pattern), Signal Studio (prompt fallback).
4. **`--yes` flag** — auto-fill with `initialValue` for text prompts and `'skip'` for select prompts was the right safe default. Signal Studio ran cleanly non-interactively.
5. **Parallel wave execution** — WU02/03/04, WU05/06, WU09/10/11 all ran in parallel with no conflicts. Wave throughput was high.
6. **Testing found a real bug** — the retrofit scaffold overwrite issue was caught by the test agents before any permanent damage. The bug was fixed in the same session (WU12).

---

## What Didn't Work

1. **Retrofit scaffold overwrite bug** — `env.ts`, `health.ts`, `info.ts`, `entitySocket.ts` were classified `'auto'` but contain project-specific values (scope, ports) set at scaffold time. The git-diff check returned "unchanged since scaffold" because the customization happened AT the scaffold commit. Tool silently overwrote them with template placeholders.
   - **Fix applied**: reclassified all 4 to `'never'` in WU12.
   - **Residual limitation**: structural improvements to these files (Zod shape changes, logger improvements) can no longer be offered via upgrade. Acceptable trade-off at current scale.

2. **WU11 committed broken scope before WU12 fix** — Signal Studio's test run committed `@appystack-template/shared` imports. Required a follow-up fix commit. Lesson: test WUs should always run a `grep` check for template placeholders before committing.

---

## Key Learnings — Application

- **Classify conservatively** — files with project-specific values at scaffold time (scope, ports, env defaults) must be `'never'`. The git-diff approach cannot distinguish "customized at scaffold" from "never customized".
- **Template scope placeholder** (`@appystack-template/shared`) propagates silently into consumer apps if classification is wrong. Always grep for it in test WUs before committing.
- **`--yes` mode**: auto-fills `text()` with `initialValue`, auto-returns `'skip'` for `select()`. This is the right safe default — never auto-overwrite modified files.
- **UPGRADE_TODO.md**: only written when user interactively picks "mark for later". With `--yes` it's skipped. That's correct — `--yes` = skip everything modified.

## Key Learnings — Ralph Loop

- **WU07 self-verified**: orchestration WUs that wire everything together should always self-test against a real target. WU07 ran against ThumbRack as part of its implementation — good practice.
- **Bug found in wave 5 testing**: real-world testing against 3 different consumer apps caught a classification bug that unit testing would have missed. The variety of test targets (true scaffold, retrofit, hand-migrated) was essential.
- **Fix WU pattern**: adding WU12 mid-campaign to fix the classification bug was clean. The IMPLEMENTATION_PLAN.md `[!]` → fix WU pattern works well.
- **Signal Studio test WU**: should have included a "grep for template placeholders" check before committing. Add this to AGENTS.md for next wave.

---

## Promote to Main KDD?

- **Two-bins-one-package pattern** — worth noting in the AppyStack architecture docs
- **Classify-conservatively rule** — add to upgrade-strategy.md known limitations (done in WU13)
- **Test WU checklist** — grep for template placeholders before committing any upgrade test

---

## Suggestions for Next Campaign

- **publish appystack-upgrade**: bump `create-appystack` to v0.4.0 and publish — the new bin is ready
- **template sync to create-appystack**: run `npm run sync` in create-appystack/ so the bundled template is current, then publish
- **future improvement**: version-tagged template diffs — when a template version bump occurs, generate a diff file showing what changed in auto-tier files. This would let the upgrade tool offer structural improvements to `env.ts`, `health.ts`, etc. without the scope/port overwrite risk.
- **FliHub/FliDeck adoption path**: separate work stream to migrate them onto `@appydave/appystack-config`. Not an upgrade — an adoption.
