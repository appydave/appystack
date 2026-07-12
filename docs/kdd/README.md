# KDD — Knowledge-Driven Development

The project's memory of **what we learned, what patterns emerged, and what we decided** — so we
stop re-solving the same problems and can learn from mistakes without archaeology through the git
log.

Maintained via the **Lisa** skill (`/lisa`). Founded 2026-07-12 by consolidating learnings that
were previously scattered in per-wave planning folders.

## Structure

| Folder | What lives here | Lifecycle |
|--------|-----------------|-----------|
| [`learnings/`](learnings/) | A single **problem → root cause → fix**, captured when it hurt | recurs 3× → promote to a pattern |
| [`patterns/`](patterns/) | A **promoted learning** — the established right-way, with anti-patterns | promoted from learnings (human-approved) |
| [`decisions/`](decisions/) | **ADRs** — a choice made, its context, alternatives, consequences | proposed → accepted → superseded |

Each folder has a `README.md` index — the entry table for that type.

## How to use it

**Before you work** (the payoff step): skim the relevant index. About to touch env config, ports,
the upgrade tool, or a dependency bump? There's probably a learning already. This is where KDD
earns its keep — reading before doing, not just writing after.

**When something bites** (capture): run `/lisa` → "capture this learning". Lisa dedups against the
existing KDD first, then either bumps a recurrence count or mints one new doc. Grab wrong-way /
right-way code while the diff is in front of you — it's unrecoverable later.

**When a learning recurs a 3rd time**: Lisa offers to promote it to a pattern (your approval).

## Conventions

- Every doc carries YAML frontmatter (topic/category/severity/status/recurrence for learnings;
  domain/name/status for patterns; adr_number/status for decisions) — see the templates in the
  Lisa skill (`references/templates/`).
- One file owns each fact. Operational procedures live in `CLAUDE.md`; the KDD owns the
  *learning* and the *decision rationale*, and cross-links rather than duplicating.
