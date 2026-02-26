# Learning: Husky in Nested Template Directory

**Discovered**: WU-8, Wave 3
**Applies to**: Any work unit touching git hooks in this project

## The Issue

`npx husky init` requires a `.git` directory in the current directory or a parent. Since `template/` is a subdirectory inside the repo (not a git root), running `npx husky init` from inside `template/` fails.

## The Fix

Create the `.husky/` directory and `pre-commit` hook file manually — this is exactly what `husky init` would have produced:

```bash
mkdir -p template/.husky
echo "npx lint-staged" > template/.husky/pre-commit
chmod 755 template/.husky/pre-commit
```

## Why This Is OK

When a developer uses this template as their own new project (as the git root), `npm install` runs the `prepare` script (`"prepare": "husky"`), which registers the hooks correctly with their git repo. The template ships with the hook file already present — husky just needs to register it on first install.

## Implication for AGENTS.md

Future agents doing any husky-related work should know to skip `npx husky init` and create the files directly.
