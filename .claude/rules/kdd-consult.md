---
paths: ['template/server/src/config/env.ts', 'create-appystack/template/server/src/config/env.ts', '**/.env.example', 'template/client/vite.config.ts', 'template/server/src/index.ts', 'config/**', 'create-appystack/bin/**', 'create-appystack/scripts/**', 'template/package.json', 'template/*/package.json', 'config/package.json', 'create-appystack/package.json']
---

# Consult the KDD before changing this file

This repo keeps a Knowledge-Driven Development library at **`docs/kdd/`** — past problems, their
root causes, and fixes. The file you're about to edit sits in an area that has **bitten before**.
Read the matching learning FIRST; it will save you from re-introducing a known bug.

| If you're touching… | Read first |
|---|---|
| `server/src/config/env.ts`, `.env*` | [`learnings/dotenv-override-clobbers-env-tests.md`](../../docs/kdd/learnings/dotenv-override-clobbers-env-tests.md) — `dotenv override:true` makes a scaffold's `.env` clobber test env → 6/7 env tests red for consumers (green in the template, so easy to miss) |
| `vite.config.ts`, `server/src/index.ts`, ports | [`learnings/port-conflict-defence.md`](../../docs/kdd/learnings/port-conflict-defence.md) — `strictPort` + `--kill-others` + `cleanupPort()`; never rely on Vite's silent port bump |
| any `package.json` dep bump | [`learnings/config-peerdeps-gate-template-upgrades.md`](../../docs/kdd/learnings/config-peerdeps-gate-template-upgrades.md) — a template dep past `config/`'s peer range fails ERESOLVE / breaks consumer installs. Also [`decisions/adr-001-hold-eslint-10.md`](../../docs/kdd/decisions/adr-001-hold-eslint-10.md) |
| `config/**` (the published config) | peer ranges are the fleet-wide upgrade ceiling — bumping them is a coordinated republish. See the config-peerdeps learning above |
| `create-appystack/` upgrade tool, `classify.js`, `appystack.json` | [`learnings/retrofit-scaffold-overwrite-bug.md`](../../docs/kdd/learnings/retrofit-scaffold-overwrite-bug.md) — retrofit scaffolds silently overwrite scaffold-time values; test against a *retrofit* app, not just fresh |

**After the work**, if you hit something new or the same thing again, capture it: run `/lisa`
("capture this learning"). Full index: [`docs/kdd/`](../../docs/kdd/README.md).
