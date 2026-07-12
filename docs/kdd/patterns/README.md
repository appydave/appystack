# Patterns Index

A pattern is a **promoted learning** — recurrence ≥ 3, human-approved. Patterns carry the
established right-way + anti-patterns. None promoted yet (KDD founded 2026-07-12).

| Pattern | Domain | Status | Recurrence |
|---------|--------|--------|------------|
| _(none yet)_ | | | |

## Promotion candidates (from learnings)

- **start.sh self-recovery from bad Overmind state** → [`learnings/start-sh-stale-overmind-socket.md`](../learnings/start-sh-stale-overmind-socket.md)
  — **recurrence 3, promotion-eligible.** Two bad states (stale sock, zombie session) across two
  apps. Could pair with port-conflict-defence into a "start.sh self-heal" pattern. Needs David's
  sign-off to promote.
- **Port conflict defence** → [`learnings/port-conflict-defence.md`](../learnings/port-conflict-defence.md)
  — already applied across 6 apps (cross-app recurrence). Strong candidate; needs David's sign-off.
- **Shared-config peer ranges as the upgrade ceiling** →
  [`learnings/config-peerdeps-gate-template-upgrades.md`](../learnings/config-peerdeps-gate-template-upgrades.md)
  — recurrence 2; one more independent hit and it's eligible.

Run `/lisa` → audit to review promotion eligibility.
