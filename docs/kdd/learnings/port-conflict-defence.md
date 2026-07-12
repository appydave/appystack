---
topic: Dev server port conflicts
issue: Vite silently bumps port on orphan collision → server EADDRINUSE crash
created: 2026-03-10
story_reference: Wave 5 (cross-app consolidation)
category: infrastructure
severity: high
status: resolved
recurrence_count: 1
promoted_to_pattern: ""
sensitivity: normal
---

# Port Conflict Defence

> **Promotion note:** this fix was consolidated from FliHub + FliGen and applied across **6 apps**
> (thumbrack, FliDeck, FliGen, FliHub, Storyline-App, template) in one pass. That's cross-app
> recurrence — this is a strong **pattern promotion candidate**. Left as a learning pending
> human sign-off (see patterns/README.md).

## Problem Signature

**Symptoms**: `npm run dev` crashes with `EADDRINUSE` on the server, seemingly at random.

**Environment**: Any coordinated client(Vite)+server(nodemon) dev setup. Weeks of intermittent pain.

**Triggering Conditions**: Stopping a session with Ctrl+C sometimes left Vite/nodemon as orphan
processes. Next `npm run dev`, Vite silently bumped to the next free port (5500 → 5501) while the
Express server stayed hardcoded to the original +1 (5501). They collided.

## Root Cause

Vite's default of **silently bumping ports** is wrong for a coordinated client+server pair. You
never want two instances on shifted ports — you want a loud failure.

## Solution

Three defences applied to the template:

**1. `strictPort: true`** in `client/vite.config.ts` — Vite exits with a clear error instead of bumping:
```typescript
server: { port: 5500, strictPort: true, proxy: { /* ... */ } }
```

**2. `--kill-others`** in the root `dev` script — any child dying kills them all (incl. Ctrl+C):
```json
"dev": "concurrently --kill-others -n server,client ..."
```

**3. `cleanupPort()`** in `server/src/index.ts` — server kills any orphan squatting on its port before binding:
```typescript
import { execSync } from 'node:child_process';
function cleanupPort(port: number | string): void {
  try {
    const result = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: 'utf-8' });
    const pids = result.trim().split('\n').filter(Boolean);
    if (pids.length > 0) {
      logger.info(`Cleaning up port ${port}: killing PIDs ${pids.join(', ')}`);
      for (const pid of pids) { try { execSync(`kill -9 ${pid} 2>/dev/null || true`); } catch { /* gone */ } }
      execSync('sleep 0.5');
    }
  } catch { /* lsof unavailable, continue */ }
}
cleanupPort(env.PORT); // before server.listen()
```

## Prevention

- **For Dev**: never rely on Vite's port-bump; `strictPort: true` is mandatory for client+server apps.
- **For Review**: a `vite.config` without `strictPort`, or a `dev` script without `--kill-others`, is a gap.
- **For Stories**: DX/port work should reference this; ongoing tracking lives at
  `~/dev/ad/brains/brand-dave/dev-pain-port-conflicts.md`.

## Related

- Story: Wave 5
- Related learnings: [[dotenv-override-clobbers-env-tests]] (also env/port scaffold behaviour)
- Related patterns: [] (promotion candidate)
