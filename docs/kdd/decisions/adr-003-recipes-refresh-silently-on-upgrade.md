---
adr_number: 3
title: Recipe specs refresh silently on upgrade (protect only detectable edits)
status: accepted
created: 2026-07-12
decision_date: 2026-07-12
story_reference: ad-hoc (captains-log upgrade noise; create-appystack@0.4.17)
supersedes: ""
superseded_by: ""
sensitivity: normal
---

# ADR-003: Recipe Specs Refresh Silently on Upgrade

## Status

Accepted

## Context

`npx appystack-upgrade` classified everything under `.claude/skills/recipe/` as the `recipe`
tier, which **prompted on every differing file** (and always on `SKILL.md`). Upgrading captains-log
surfaced a wall of "File differs from template" prompts for recipe reference specs the developer
never touched — pure noise. The diffs were real (the app was scaffolded from an older template),
but recipe specs are **template-owned intelligence the developer *invokes* (via the recipe skill),
not code they customize**. Prompting to confirm each one is friction with no payoff.

## Decision

Change the recipe handler (`create-appystack/bin/lib/recipe.js`) to refresh recipe files quietly:

1. **Not in consumer** → auto-add.
2. **Edited since scaffold** (detectable only with a scaffold baseline; recipe specs carry no
   scaffold-time substitutions, so a non-empty `git diff` is a genuine hand edit) → **protect it**:
   route to the diff-and-prompt path (`handleAutoFile`).
3. **Unedited, or no scaffold baseline** → **silently refresh** to the template version
   (`identical` → skip, otherwise overwrite, no prompt).

Classification stays `recipe`; the *handler* got smarter. `SKILL.md` lost its always-prompt — it's
template-owned too, so it follows the same rule.

## Alternatives Considered

- **Keep diff-and-confirm on every recipe file** — rejected: that's the noise we're removing;
  developers blanket-skip and stop reading (the exact failure the tier system was meant to avoid).
- **Blanket-reclassify recipe files as `auto`** — rejected: `auto`'s no-baseline branch *also*
  prompts on content-differ, so it wouldn't kill the noise; and it scatters recipe-specific logic.
- **Silently overwrite recipes unconditionally** — rejected: would clobber a deliberate hand edit
  with no warning when a baseline *is* available; step 2 protects that case cheaply.

## Consequences

- Quiet upgrades: untouched recipe specs refresh without prompts — developers see only files that
  matter (their own edits, `never`-tier app code left alone).
- A developer who edited a recipe still gets a diff+prompt **when a scaffold baseline exists**.
  Without a baseline (e.g. `appystack.json` missing — see the appystack.json false-negative backlog
  item), an edited recipe would be silently refreshed; acceptable given recipes are template-owned,
  and fully mitigated once baselines are reliable.
- Locked by `create-appystack/tests/recipe.test.js` (5 cases: add / identical / silent-refresh
  ×2 / edit-protected-prompt).

## Related

- Patterns: []
- Learnings: [[retrofit-scaffold-overwrite-bug]] (the other side of upgrade-tool file classification)
- Stories: ad-hoc 2026-07-12 (captains-log)
