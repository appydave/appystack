# Learning: Port Conflict Defence

**Date**: 2026-03-10
**Pain duration**: Weeks (affected thumbrack, FliDeck, FliGen, FliHub, Storyline-App)

---

## What Was Happening

When a dev session was stopped with Ctrl+C, Vite and/or nodemon would sometimes survive as orphan processes. On the next `npm run dev`, Vite silently bumped to the next available port (e.g. 5020 → 5021). The Express server was still hardcoded to the original +1 port (5021). They collided. Server crashed with EADDRINUSE.

**The core problem**: Vite's default behaviour of silently bumping ports is wrong for coordinated client+server setups. You never want two instances running on different ports — you want a loud failure.

---

## Three Fixes Applied to the Template

### 1. `strictPort: true` in `client/vite.config.ts`

```typescript
server: {
  port: 5500,
  strictPort: true,  // fail loud, don't bump
  proxy: { ... }
}
```

Vite now exits with a clear error message instead of silently running on a different port.

### 2. `--kill-others` in the root `dev` script

```json
"dev": "concurrently --kill-others -n server,client ..."
```

All children (Vite, nodemon) die when any one exits — including on Ctrl+C.

### 3. `cleanupPort()` in `server/src/index.ts`

```typescript
import { execSync } from 'node:child_process';

function cleanupPort(port: number | string): void {
  try {
    const result = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: 'utf-8' });
    const pids = result.trim().split('\n').filter(Boolean);
    if (pids.length > 0) {
      logger.info(`Cleaning up port ${port}: killing PIDs ${pids.join(', ')}`);
      for (const pid of pids) {
        try { execSync(`kill -9 ${pid} 2>/dev/null || true`); } catch { /* already gone */ }
      }
      execSync('sleep 0.5');
    }
  } catch { /* lsof unavailable, continue */ }
}

// Call before server.listen()
cleanupPort(env.PORT);
```

The server kills any orphan squatting on its port before trying to bind.

---

## Where This Pattern Came From

FliHub already had `cleanupPort()` (added independently). FliGen already had `-k`. Neither had `strictPort`. The pattern was consolidated and applied to all six apps in one pass.

---

## Ongoing Tracking

`~/dev/ad/brains/brand-dave/dev-pain-port-conflicts.md` — cross-app status table and backlog for future DX issues.
