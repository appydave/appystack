---
topic: Git hooks / Husky
issue: npx husky init fails inside the nested template/ directory
created: 2026-02-26
story_reference: Wave 3 / WU-8
category: tooling
severity: low
status: resolved
recurrence_count: 1
promoted_to_pattern: ""
sensitivity: normal
---

# Husky in a Nested Template Directory

## Problem Signature

**Symptoms**: `npx husky init` fails when run from inside `template/`.

**Environment**: Repo tooling. `template/` is a subdirectory of the repo, not a git root.

**Triggering Conditions**: `npx husky init` requires a `.git` directory in the current directory
or a parent. `template/` has none of its own.

## Root Cause

Husky's `init` bootstraps against a git root. The template is intentionally *not* a git root — it
becomes one only when a developer scaffolds it into their own new project.

## Solution

Create the `.husky/` dir and `pre-commit` hook manually — exactly what `husky init` would emit:
```bash
mkdir -p template/.husky
echo "npx lint-staged" > template/.husky/pre-commit
chmod 755 template/.husky/pre-commit
```

When a developer later uses the template as their own repo root, `npm install` runs the `prepare`
script (`"prepare": "husky"`), which registers the shipped hook against their git repo correctly.

## Prevention

- **For Dev**: doing husky work in this repo? Skip `npx husky init`; create the files directly.
- **For Review**: a `husky init` invocation in template tooling is a smell.

## Related

- Story: Wave 3, WU-8
- Related learnings: []
- Related patterns: []
