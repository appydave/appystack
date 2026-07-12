---
topic: Dev server startup / Overmind
issue: start.sh could not recover from a stale .overmind.sock left by a crashed session
created: 2026-07-12
story_reference: ad-hoc (captains-log; BACKLOG "start.sh does not self-recover")
category: infrastructure
severity: high
status: resolved
recurrence_count: 2
promoted_to_pattern: ""
sensitivity: normal
---

# start.sh Can't Recover From a Stale Overmind Socket

> **Recurrence 2** — first seen on digital-stage-summit-2026 (fix noted in BACKLOG, never
> backported), hit again on captains-log 2026-07-12. Related: [[port-conflict-defence]].

## Problem Signature

**Symptoms**: `./scripts/start.sh` builds shared, prints "Starting via Overmind…", then:
```
overmind: it looks like Overmind is already running. If it's not, remove ./.overmind.sock and try again
```
The app is **not** running — `http://localhost:<client-port>` gives `ERR_CONNECTION_REFUSED`.

**Environment**: any AppyStack app started via Overmind (`scripts/start.sh`) after a previous
session crashed or was force-killed.

**Triggering Conditions**: a crash/kill leaves `.overmind.sock` on disk. `overmind start` refuses
to launch while that socket exists — even though no Overmind/tmux session is actually alive. The
original `start.sh` cleaned up *port squatters* but never the socket, so it could not self-recover.

## Root Cause

The socket file is Overmind's "already running" sentinel. Its mere presence blocks `overmind
start`; the script had no step to distinguish "socket present + Overmind live" from "socket present
but stale".

## Solution

Before `overmind start`, self-heal — but don't kill a genuinely-running session:
```bash
if [[ -e .overmind.sock ]]; then
  if overmind status >/dev/null 2>&1; then      # socket-backed session is actually alive
    echo "Overmind is already running for this project."
    open "http://localhost:${CLIENT_PORT}"       # attach/point at it, don't restart
    exit 0
  fi
  echo "Removing stale .overmind.sock (no live Overmind found)..."
  rm -f .overmind.sock                            # stale → clean and proceed
fi
```
`overmind status` succeeds only when a live session is behind the socket; non-zero ⇒ stale ⇒ safe
to `rm`. Verified across three cases (stale → cleaned, live → attach+exit, no-sock → normal).
`scripts/start.sh` is `auto`-tier in the upgrade classifier, so this lands on consumer apps via
`npx appystack-upgrade` without a prompt. Shipped in `create-appystack@0.4.16`.

## Prevention

- **For Dev**: a startup script that wraps a socket-guarded process manager must detect and clear a
  *stale* socket — presence ≠ running. Prefer attach-if-live over kill-and-restart.
- **For Review**: any `overmind start` / `foreman`-style launcher without a stale-sentinel check is
  incomplete — it will strand users in an "already running" loop.
- **For Stories**: test the *crash-recovery* path (kill mid-run, restart), not just the clean start.

## Related

- Story: ad-hoc 2026-07-12 (captains-log)
- Related learnings: [[port-conflict-defence]] (the other half of start.sh's self-defence)
- Related patterns: []
