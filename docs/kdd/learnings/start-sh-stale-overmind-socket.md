---
topic: Dev server startup / Overmind
issue: start.sh could not recover from a bad Overmind state — stale socket, then a zombie session with dead processes
created: 2026-07-12
story_reference: ad-hoc (captains-log; BACKLOG "start.sh does not self-recover")
category: infrastructure
severity: high
status: resolved
recurrence_count: 3
promoted_to_pattern: ""
sensitivity: normal
---

# start.sh Can't Recover From a Bad Overmind State

> **Recurrence 3** — digital-stage-summit-2026 (stale sock, BACKLOG note, never backported);
> captains-log 2026-07-12 stale sock (0.4.16 fix); captains-log 2026-07-12 **zombie session**
> (0.4.16 fix was incomplete, corrected in 0.4.18). Two distinct bad states, same "can't
> self-recover" theme. **Promotion-eligible** (≥3) — see patterns/README.md. Related:
> [[port-conflict-defence]].

## Problem Signature

**Symptoms** (two variants):
- **Stale socket**: `overmind start` refuses — `it looks like Overmind is already running.
  If it's not, remove ./.overmind.sock and try again`. App unreachable.
- **Zombie session**: `start.sh` prints "Overmind is already running… Opening browser…" and
  exits, but `http://localhost:<port>` gives `ERR_CONNECTION_REFUSED`. `overmind status` shows
  every process `dead`, and multiple orphaned `overmind start -D` daemons + tmux servers have
  piled up from repeated attempts.

**Environment**: any AppyStack app started via Overmind (`scripts/start.sh`) after a crash, kill,
or a series of colliding start attempts.

## Root Cause

Two layered mistakes:
1. **Original `start.sh`** cleaned up *port squatters* but never the socket → couldn't clear a
   stale `.overmind.sock` (the "already running" sentinel).
2. **The 0.4.16 fix used `overmind status` exit code** to decide "is it alive?" — but
   **`overmind status` exits 0 as long as the daemon answers, even when every managed process is
   `dead`**. So a zombie session (daemon up, client/server dead) looked "already running", the
   script attached + exited, and nothing ever started. Repeated runs then orphaned more daemons.

`overmind` is built on `tmux`; the `tmux -L overmind-<app>-*` processes are Overmind's own
internals, not the developer's terminals — safe to reap when the session is dead.

## Solution

Check the **STATUS column for an actually-running process**, not the exit code; and shut a dead
daemon down cleanly (don't just `rm` the sock and orphan it):
```bash
if [[ -e .overmind.sock ]]; then
  # WRONG (0.4.16): `if overmind status >/dev/null 2>&1` — exits 0 for a zombie (dead procs)
  if overmind status 2>/dev/null | grep -qw running; then   # a process is genuinely up
    echo "Overmind is already running for this project."
    open "http://localhost:${CLIENT_PORT}"                    # attach, don't restart
    exit 0
  fi
  echo "Found a dead/stale Overmind session — cleaning it up..."
  overmind quit >/dev/null 2>&1 || true                       # shut the daemon (no orphan)
  rm -f .overmind.sock
fi
```
Verified: all-dead → cleanup+restart; all-running → attach; partial-running → attach. Shipped in
`create-appystack@0.4.18`. `scripts/start.sh` is `auto`-tier, so consumers get it via
`npx appystack-upgrade`. Manual recovery for an already-piled-up app: kill the `tmux -L
overmind-<app>-*` servers + the cwd-matched `overmind start` daemons, then `rm -f .overmind.sock`.

## Prevention

- **For Dev**: with a process manager, **a zero exit code from a "status"/"ping" command means the
  daemon answered, NOT that the workload is healthy.** Inspect actual process/health state.
- **For Review**: any liveness check that trusts an exit code over process state is a false-positive
  waiting to happen; any launcher that can spawn a second daemon without reaping the first will pile
  up orphans.
- **For Stories**: test *both* bad-recovery paths — stale socket AND zombie session (kill the inner
  processes but leave the daemon) — not just a clean start.

## Related

- Story: ad-hoc 2026-07-12 (captains-log)
- Related learnings: [[port-conflict-defence]] (the other half of start.sh's self-defence), [[npx-cache-serves-stale-upgrade-tool]]
- Related patterns: []
