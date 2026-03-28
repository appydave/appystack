# App Idea — Design Spec

**Purpose**: Design for `/app-idea`, a project-level skill that manages the lifecycle of user-requested capabilities in live AppyStack applications.

**Context**: Mid-flight feature intake for running apps. Users (Angela, end users, David in capture mode) generate ideas faster than they can be processed. The system tracks every idea from raw capture through to delivery or rejection. Nothing disappears silently.

**Created**: 2026-03-28

---

## Problem

The same capture-triage-build-close pattern has been built 5 times with 5 different names:

| Project | Capture File | Skill | Status |
|---------|-------------|-------|--------|
| Signal Studio | `AngelaFeedback.md` (815 lines, 34+ items) | `/angela` (4 modes) | Most mature |
| AngelEye | `AngelFeedback.md` | `/angel` (C/T modes) | Just scaffolded |
| FliHub | `flihub-feedback.md` (F-series) | Handover queue skill | Older pattern |
| AppyStack | `BACKLOG.md` | Recipe skill | Simplest |
| SupportSignal Prompts | `angela-feedback.md` + 2 more | Manual | Domain-specific |

Same workflow, different implementations. This spec standardises it.

---

## What This Is

- An intake queue with zero-friction capture for stakeholders
- A triage ceremony with recorded decisions and reasoning
- A typing step that classifies raw ideas as FR (feature request) or BUG
- A disposition tracker so nothing disappears silently
- A project-level skill that ships via AppyStack template

## What This Is NOT

- Not a project management tool (no sprints, velocity, burndown)
- Not tied to any build method (not BMAD, not Ralphy, not plan-mode)
- Not a greenfield discovery tool (the app exists, it's running)

---

## Architecture

### Two-Layer Model

**Layer 1: Machine-readable index** (`index.json`)
- Every item's current state, type, metadata
- Lean — no long descriptions, just title + pointers
- What the skill reads first for filtering, counting, dashboards

**Layer 2: Human-readable documents** (individual markdown files)
- Full context: raw description, screenshots, acceptance criteria
- What you read when you actually work on an item

The index is the source of truth for *state*. The document is the source of truth for *content*.

### File Structure

```
app-idea/
├── index.json          <- machine-readable state for all items
├── 001-BUG.md          <- triaged as bug
├── 002-FR.md           <- triaged as feature request
├── 003.md              <- raw idea, not yet triaged
├── 004-FR.md           <- triaged as feature request
├── 005.md              <- deferred (stays untyped)
```

**Naming convention**: `{sequential-number}.md` at capture, renamed to `{sequential-number}-{TYPE}.md` at triage. Number-first so files sort chronologically.

**Types**: `FR` (feature request), `BUG` (bug/defect). Extend later if needed (CHORE, NFR) — don't build until required.

---

## Item Lifecycle

### States

| State | Meaning | Has file? | File named? |
|-------|---------|-----------|-------------|
| **open** | Captured, not yet reviewed | Yes | `NNN.md` |
| **accepted** | Triaged, will be built, appetite assigned | Yes | `NNN-TYPE.md` |
| **in-progress** | Someone's working on it | Yes | `NNN-TYPE.md` |
| **done** | Shipped, verified | Yes | `NNN-TYPE.md` |
| **deferred** | Parked with reason and revisit conditions | Yes | `NNN.md` (stays untyped) |
| **rejected** | Won't do, reason permanently recorded | Yes | `NNN.md` (stays untyped) |

### State Transitions

```
open ──triage──> accepted ──> in-progress ──> done
                    │
open ──triage──> deferred (with reason + revisit conditions)
                    │
open ──triage──> rejected (with reason, permanent record)
```

Deferred items can be re-opened. Rejected items are permanent.

### What Happens at Each Transition

**Capture (new -> open)**:
1. Next sequential number assigned
2. `NNN.md` file created with raw description (can be long — screenshots, context, whatever)
3. Index entry added: id, title (one line), status=open, source, created date, file pointer

**Triage (open -> accepted/deferred/rejected)**:
1. David reviews the idea
2. If accepted: type assigned (FR/BUG), appetite set (S/M/L), file renamed to `NNN-TYPE.md`, David can add structure (acceptance criteria, scope)
3. If deferred: reason + revisit conditions recorded in index, file stays as `NNN.md`
4. If rejected: reason recorded in index, file stays as `NNN.md`

**Work (accepted -> in-progress -> done)**:
1. Status updates in index as work proceeds
2. Build method is whatever fits (Ralphy, plan-mode, ad-hoc Claude Code)
3. On completion: status=done, completion date recorded

---

## Index Schema

```json
{
  "items": [
    {
      "id": 1,
      "title": "Save button doesn't work on mobile",
      "status": "open",
      "source": "Angela",
      "created": "2026-03-28",
      "file": "003.md"
    },
    {
      "id": 2,
      "title": "Add bulk export for participant reports",
      "status": "accepted",
      "type": "FR",
      "ref": "FR-001",
      "appetite": "M",
      "source": "Angela",
      "created": "2026-03-25",
      "triaged": "2026-03-26",
      "file": "001-FR.md"
    },
    {
      "id": 5,
      "title": "Dark mode support",
      "status": "deferred",
      "source": "David",
      "created": "2026-03-20",
      "triaged": "2026-03-26",
      "reason": "Nice to have but no user demand yet. Revisit after v2 launch.",
      "file": "005.md"
    },
    {
      "id": 7,
      "title": "Integrate with MYOB accounting",
      "status": "rejected",
      "source": "Angela",
      "created": "2026-03-22",
      "triaged": "2026-03-26",
      "reason": "Out of scope for this product. NDIS billing handled by plan managers.",
      "file": "007.md"
    }
  ]
}
```

### Index Fields

| Field | When Set | Required | Notes |
|-------|----------|----------|-------|
| `id` | Capture | Yes | Sequential, never reused |
| `title` | Capture | Yes | One line, plain language |
| `status` | Capture | Yes | open/accepted/deferred/rejected/in-progress/done |
| `source` | Capture | Yes | Who raised it (Angela, David, end user name) |
| `created` | Capture | Yes | Date captured |
| `file` | Capture | Yes | Filename pointer |
| `type` | Triage | On accept | FR or BUG |
| `ref` | Triage | On accept | e.g. FR-001, BUG-003 (type + sequential per type) |
| `appetite` | Triage | On accept | S (< 1hr), M (half day), L (multi-day) |
| `triaged` | Triage | On triage | Date triaged |
| `reason` | Triage | On defer/reject | Why deferred or rejected |
| `completed` | Close | On done | Date completed |

---

## Appetite

| Size | Time | Build Method (typical) |
|------|------|----------------------|
| **S** | Under 1 hour | Ad-hoc Claude Code, one-shot fix |
| **M** | Half a day | Plan-mode, Ralphy loop |
| **L** | Multi-day | Structured approach, multiple sessions |

Appetite is set at triage. It answers: "how much time am I willing to spend on this?" — not "how long will it take?" This is a business decision, not an estimate.

---

## Skill Commands

```
/app-idea                -> Status dashboard + offer capture or triage
/app-idea capture        -> Add one or more ideas (stakeholder hat)
/app-idea triage         -> Walk through open items, decide each (PO hat)
/app-idea status         -> Dashboard: open count, accepted, in-progress, done, deferred, rejected
/app-idea close          -> Mark in-progress items as done
```

### Capture Mode

- Zero friction — stakeholder describes what they want in plain language
- Skill assigns next sequential number
- Creates `NNN.md` with raw description
- Appends to index.json
- Can capture multiple ideas in one session

### Triage Mode

- Reads index.json, presents open items one by one
- For each: David decides — accept (assign type + appetite), defer (with reason), reject (with reason)
- On accept: file renamed to `NNN-TYPE.md`, index updated
- On defer/reject: reason recorded, file stays as `NNN.md`

### Status Mode

- Reads index.json, produces summary counts by status
- Lists accepted items by appetite
- Flags items that have been open for a long time (configurable threshold)

### Close Mode

- Lists in-progress items
- David confirms which are done
- Index updated with completion date

---

## Actors

| Role | Stage | What They Do | Who Plays It |
|------|-------|--------------|-------------|
| **Stakeholder** | Capture | Describes needs in plain language | Angela, end users, David |
| **Scribe** | Capture | Writes structured entry, flags conflicts | Claude (in capture mode) |
| **Product Owner** | Triage | Decides type, appetite, disposition | David |
| **Builder** | Build | Implements via whatever method fits | Claude agents, David |

---

## Distribution

- Ships as a project-level skill in AppyStack template (`{project}/.claude/skills/app-idea/`)
- Existing AppyStack projects receive it via `appystack-upgrade`
- New projects get it automatically via `create-appystack`
- The `app-idea/` data directory is scaffolded by the skill on first use (or by a recipe)

---

## Research Sources

Design informed by:
- **GTD** (David Allen): Zero-friction capture, clarify decision tree for triage
- **Shape Up** (Basecamp): Appetite concept (fixed time, variable scope), pitch format
- **OpenSpec** (Fission AI): Change-as-directory pattern, living spec library
- **SpecKit** (GitHub): Sequential slash command UX pattern
- **Canny/ProductBoard**: Close-the-loop pattern (notify when shipped)
- **BMAD v6**: Confirmed gap — no pre-Phase 1 intake. Quick Flow/Barry is a valid exit point for small items in BMAD projects, but this system is method-agnostic
- **David's 5 existing implementations**: Signal Studio (/angela), AngelEye (/angel), FliHub, AppyStack (BACKLOG.md), SupportSignal Prompts

---

## Open Decisions (for implementation)

1. **Scaffold timing**: Does `app-idea/` directory + index.json get created by the skill on first `/app-idea capture`, or scaffolded at project creation?
2. **File template**: What sections does a raw `NNN.md` file have? Just a title + raw description? Or a light template?
3. **Typed file template**: What sections does `NNN-FR.md` or `NNN-BUG.md` have after triage? Problem + Appetite + Scope + Acceptance Criteria?
4. **Stale item threshold**: How long before an open item gets flagged in status? 7 days? 14 days?
5. **Ref numbering**: FR-001 and BUG-001 each have independent sequences? Or one global sequence?
