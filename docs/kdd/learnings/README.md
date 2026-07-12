# Learnings Index

A learning = one **problem → root cause → fix**. Recurs 3× → promote to a [pattern](../patterns/).
Scan this before touching the area it covers.

| Learning | Category | Sev | Status | Recur |
|----------|----------|-----|--------|-------|
| [dotenv `override:true` clobbers env tests](dotenv-override-clobbers-env-tests.md) | testing | high | resolved | 1 |
| [Config `peerDependencies` gate template upgrades](config-peerdeps-gate-template-upgrades.md) | tooling | medium | active | 2 ⬆ |
| [Retrofit scaffold silent overwrite](retrofit-scaffold-overwrite-bug.md) | tooling | high | **active** | 1 |
| [Port conflict defence](port-conflict-defence.md) | infrastructure | high | resolved | 1 (pattern candidate) |
| [Express 5 — req.query is read-only](express5-req-query-readonly.md) | backend | medium | resolved | 1 |
| [Husky in a nested template dir](husky-nested-template.md) | tooling | low | resolved | 1 |

**Queues:**
- ⬆ **Promotion-eligible on next recurrence**: config-peerdeps (at 2), port-conflict-defence (cross-app, human sign-off pending).
- **Open / active**: retrofit-scaffold-overwrite-bug (confirm the `'never'`-tier fix landed), config-peerdeps.
