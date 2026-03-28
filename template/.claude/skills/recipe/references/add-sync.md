# Recipe: Add Sync

Cross-machine synchronisation for AppyStack apps. Covers code updates (via Git), data sharing (via Git or shared folders), and the UI patterns that make sync visible and safe for both developers and non-technical users.

This recipe is a **routing recipe** — it asks questions first, then generates a targeted build prompt for one or more sync sub-types. Each sub-type can be applied independently or composed together.

---

## Recipe Anatomy

**Intent**
Add the ability for an AppyStack app to synchronise code and/or data between machines, with appropriate UI feedback for the target audience. The recipe covers the full spectrum from "developer pushes, others pull" to "multiple contributors push and pull with conflict resolution" to "data syncs via shared folder without Git".

**Type**: Additive. Can be layered onto any AppyStack app at any stage.

**Stack Assumptions**
- AppyStack RVETS template (Express 5, Socket.io, TypeScript, React 19)
- Git repository with a remote (GitHub, GitLab, etc.)
- For shared-folder sub-types: Dropbox, Syncthing, or similar already configured at the OS level

**Idempotency Check**
- Does `server/src/services/git-sync.service.ts` exist? → Git sync already installed
- Does `server/src/routes/git-sync.ts` exist? → Git sync routes already installed
- Does `client/src/hooks/useGitSync.ts` exist? → Git sync hook already installed
- Does `server/src/services/folder-sync.service.ts` exist? → Folder sync already installed

**Does Not Touch**
- Entity CRUD logic — sync is infrastructure, not domain
- Authentication — add `add-auth` recipe first if sync operations need to be role-gated
- Socket.io entity events — sync uses REST endpoints, not the entity socket contract

**Composes With**
- `file-crud` — data stored as JSON files is the most natural fit for git-based data sync
- `nav-shell` — sync indicators mount in the header
- `entity-socket-crud` — after a git pull that changes data files, the chokidar watcher fires `entity:external-change` events automatically
- `local-service` — Overmind-aware restart after pull (server exits, Overmind restarts)
- `add-auth` — role-gate push operations (e.g. only admin can push)

---

## Sub-Types

| Sub-type | What it does | Best for |
|----------|-------------|----------|
| **A: Pull-Only Git Sync** | Server polls upstream, UI shows status pill, user clicks to pull | Non-developers receiving updates from a developer |
| **B: Full Git Sync (Push + Pull)** | Both push and pull from UI, with conflict resolution | Multiple contributors who all make changes |
| **C: Git Data Commit** | Commit data file changes to git (separate from code) | Apps that store data as files and want to version-control data |
| **D: Shared Folder Sync** | Watch a folder synced by Dropbox/Syncthing, show incoming changes | Large files, non-git content, peer-to-peer without GitHub |

Sub-types can be combined:
- **A + C** = Users pull code updates AND commit their data changes (Signal Studio pattern)
- **B alone** = Full collaboration hub (FliHub pattern)
- **A + D** = Pull code from Git, receive data via shared folder
- **C + D** = Commit data to Git AND receive files via shared folder

---

## Routing Questions

Before generating the build prompt, ask these questions in order. Each answer narrows which sub-type(s) to implement.

### Q1: Who are the users of this app?

| Answer | Implication |
|--------|-------------|
| "Just me (developer)" | You probably don't need this recipe — `/push` skill + `git pull` in terminal is enough |
| "Me + non-technical teammates" | Sub-type A (pull-only) is the starting point |
| "Multiple developers" | Sub-type B (full push + pull) with conflict resolution |
| "Mixed — some developers, some not" | Sub-type A for non-developers, Sub-type B for developers (role-gated) |

### Q2: What needs to sync?

| Answer | Implication |
|--------|-------------|
| "Code only — app updates" | Sub-type A or B (git sync) |
| "Data only — entity records" | Sub-type C (git data commit) or D (shared folder) |
| "Both code and data" | Sub-type A/B + Sub-type C/D |
| "Large files (video, images, exports)" | Sub-type D (shared folder) — git is wrong for large binaries |

### Q3: How should data changes get to the other machine?

| Answer | Implication |
|--------|-------------|
| "Through GitHub (git commit + push)" | Sub-type C — data lives in `data/` dir, committed to git |
| "Through a shared folder (Dropbox, Syncthing)" | Sub-type D — app watches a sync folder for incoming changes |
| "Through an API endpoint" | Not this recipe — use `api-endpoints` recipe instead |
| "Data doesn't leave this machine" | Skip data sync entirely |

### Q4: Should the app restart after pulling code changes?

| Answer | Implication |
|--------|-------------|
| "Yes — running under Overmind / process manager" | Restart-aware pull (detect `OVERMIND_SOCKET`, schedule `process.exit(0)`, client polls `/health` and reloads) |
| "No — I'll restart manually" | Simple pull, no restart logic |
| "Not sure" | Default to restart-aware — it's safe either way (no-ops without Overmind) |

### Q5: How often should the app check for updates?

| Answer | Implication |
|--------|-------------|
| "Every 2 minutes" (default) | `GIT_SYNC_POLL_MS=120000` — good balance of freshness vs. GitHub API load |
| "More often (30s–60s)" | Lower interval — fine for local network, may hit GitHub rate limits on public repos |
| "Less often (5–10 min)" | Higher interval — less network traffic, longer delay before users see updates |
| "Only when user clicks" | Disable polling, add a manual "Check for updates" button |

### Q6: What language should sync status use?

This is critical for non-technical users. The same git state needs different words.

| Audience | "behind" state | "dirty" state | "ahead" state | "pull" action |
|----------|---------------|---------------|---------------|---------------|
| Developer | "3 behind" | "Dirty" | "2 ahead" | "Pull" |
| Non-technical user | "Update available" | "You have unsaved changes" | "Your changes haven't been shared yet" | "Get latest" |
| Operator | "3 updates from David" | "Uncommitted changes" | "2 changes to push" | "Sync now" |

**Ask**: "What words should the sync pill use? Developer jargon, plain English, or something custom?"

---

## Sub-Type A: Pull-Only Git Sync

The simplest and most common pattern. One person (the developer) pushes code; everyone else's app detects the update and offers a one-click pull.

**Discovered in**: AngelEye (Wave 12, March 2026)

### Shared Types

```typescript
// shared/src/git-sync.ts
export type GitSyncState =
  | 'clean'    // everything up to date
  | 'behind'   // remote has new commits — user can pull
  | 'dirty'    // uncommitted local changes — pull blocked
  | 'ahead'    // local commits not on remote (developer pushed from here)
  | 'diverged' // both ahead and behind — needs manual resolution
  | 'error'    // fetch failed, no upstream, etc.
  | 'pulling'; // transient state during pull operation

export interface CommitSummary {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface GitSyncStatus {
  state: GitSyncState;
  branch: string;
  localCommit: string;
  remoteCommit: string;
  behind: number;
  ahead: number;
  dirty: boolean;
  lastChecked: string;
  error?: string;
  behindCommits?: CommitSummary[];
}

export interface GitPullResult {
  success: boolean;
  previousCommit: string;
  newCommit: string;
  commitsPulled: number;
  error?: string;
  restartTriggered: boolean;
}
```

### Server Service

```typescript
// server/src/services/git-sync.service.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'path';
import { logger } from '../config/logger.js';
import type { GitSyncState, GitSyncStatus, GitPullResult, CommitSummary } from '@scope/shared';

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(process.cwd(), '..');

// execFile (not exec) — no shell injection risk
// GIT_TERMINAL_PROMPT=0 — prevents hanging on credential prompts
async function git(args: string[], timeoutMs = 15_000): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: REPO_ROOT,
    timeout: timeoutMs,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return stdout.trim();
}

// Promise-chain mutex — prevents concurrent git operations (poll vs pull race)
let lockChain = Promise.resolve();

function withGitLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = lockChain.then(fn, fn);
  lockChain = next.then(() => {}, () => {});
  return next;
}

function deriveState(dirty: boolean, behind: number, ahead: number): GitSyncState {
  if (dirty) return 'dirty';
  if (behind > 0 && ahead > 0) return 'diverged';
  if (behind > 0) return 'behind';
  if (ahead > 0) return 'ahead';
  return 'clean';
}

function parseCommitLog(raw: string): CommitSummary[] {
  if (!raw) return [];
  return raw.split('\n').map((line) => {
    const [sha, message, author, date] = line.split('|');
    return { sha, message, author, date };
  });
}

export function checkStatus(): Promise<GitSyncStatus> {
  return withGitLock(async (): Promise<GitSyncStatus> => {
    const now = new Date().toISOString();

    // 1. fetch (failure non-fatal → error state)
    try {
      await git(['fetch', '--quiet'], 15_000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ err }, 'git fetch failed');
      return {
        state: 'error', branch: '', localCommit: '', remoteCommit: '',
        behind: 0, ahead: 0, dirty: false, lastChecked: now,
        error: `Fetch failed: ${message}`,
      };
    }

    // 2. branch + commits
    const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
    const localCommit = await git(['rev-parse', '--short', 'HEAD']);

    let remoteCommit: string;
    try {
      remoteCommit = await git(['rev-parse', '--short', '@{upstream}']);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        state: 'error', branch, localCommit, remoteCommit: '',
        behind: 0, ahead: 0, dirty: false, lastChecked: now,
        error: `No upstream: ${message}`,
      };
    }

    // 3. ahead/behind
    const revList = await git(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
    const [aheadStr, behindStr] = revList.split(/\s+/);
    const ahead = parseInt(aheadStr, 10) || 0;
    const behind = parseInt(behindStr, 10) || 0;

    // 4. dirty check
    const porcelain = await git(['status', '--porcelain'], 5_000);
    const dirty = porcelain.length > 0;

    // 5. behind commits (for modal display)
    let behindCommits: CommitSummary[] | undefined;
    if (behind > 0) {
      const logOutput = await git(['log', '--format=%h|%s|%an|%aI', 'HEAD..@{upstream}', '-10']);
      behindCommits = parseCommitLog(logOutput);
    }

    return {
      state: deriveState(dirty, behind, ahead),
      branch, localCommit, remoteCommit,
      behind, ahead, dirty, lastChecked: now,
      behindCommits,
    };
  });
}

export function pullUpstream(): Promise<GitPullResult> {
  return withGitLock(async (): Promise<GitPullResult> => {
    // Refuse on dirty tree
    const porcelain = await git(['status', '--porcelain'], 5_000);
    if (porcelain.length > 0) {
      return {
        success: false, previousCommit: '', newCommit: '',
        commitsPulled: 0, restartTriggered: false,
        error: 'Uncommitted changes detected — commit or stash before pulling',
      };
    }

    const previousCommit = await git(['rev-parse', '--short', 'HEAD']);

    try {
      await git(['pull', '--rebase'], 120_000);
    } catch (err) {
      // Abort rebase on failure
      try { await git(['rebase', '--abort'], 10_000); } catch { /* already clean */ }
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false, previousCommit, newCommit: previousCommit,
        commitsPulled: 0, restartTriggered: false,
        error: `Pull failed: ${message}`,
      };
    }

    const newCommit = await git(['rev-parse', '--short', 'HEAD']);
    const countOutput = await git(['rev-list', '--count', `${previousCommit}..HEAD`]);
    const commitsPulled = parseInt(countOutput, 10) || 0;

    // Restart if running under Overmind
    let restartTriggered = false;
    if (process.env.OVERMIND_SOCKET) {
      restartTriggered = true;
      logger.info('Pull complete — scheduling process exit for Overmind restart');
      setTimeout(() => process.exit(0), 2000);
    }

    return { success: true, previousCommit, newCommit, commitsPulled, restartTriggered };
  });
}
```

### Server Routes

```typescript
// server/src/routes/git-sync.ts
import { Router } from 'express';
import { checkStatus, pullUpstream } from '../services/git-sync.service.js';
import { apiSuccess, apiFailure } from '../helpers/response.js';
import { logger } from '../config/logger.js';

const router = Router();

router.get('/status', async (_req, res) => {
  try {
    const status = await checkStatus();
    return apiSuccess(res, status);
  } catch (err) {
    logger.error({ err }, 'git-sync status check failed');
    return apiFailure(res, 'Git sync status check failed', 500);
  }
});

router.post('/pull', async (_req, res) => {
  try {
    const result = await pullUpstream();
    return apiSuccess(res, result);
  } catch (err) {
    logger.error({ err }, 'git-sync pull failed');
    return apiFailure(res, 'Git pull failed', 500);
  }
});

export { router as gitSyncRouter };
```

Mount in `server/src/index.ts`:
```typescript
import { gitSyncRouter } from './routes/git-sync.js';
app.use('/api/git-sync', gitSyncRouter);
```

### Client Hook

```typescript
// client/src/hooks/useGitSync.ts
import { useState, useEffect, useCallback } from 'react';
import type { GitSyncStatus, GitPullResult } from '@scope/shared';

const DEFAULT_POLL_MS = 120_000;

export function useGitSync() {
  const [status, setStatus] = useState<GitSyncStatus | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<GitPullResult | null>(null);

  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    async function getPollInterval(): Promise<number> {
      try {
        const res = await fetch('/api/info');
        const json = await res.json();
        if (json.status === 'ok' && typeof json.data?.gitSyncPollMs === 'number') {
          return json.data.gitSyncPollMs;
        }
      } catch { /* server down — use default */ }
      return DEFAULT_POLL_MS;
    }

    async function check() {
      try {
        const res = await fetch('/api/git-sync/status');
        const json = await res.json();
        if (mounted && json.status === 'ok') setStatus(json.data);
      } catch { /* server down */ }
    }

    async function start() {
      const pollMs = await getPollInterval();
      if (!mounted) return;
      await check();
      if (!mounted) return;
      intervalId = setInterval(check, pollMs);
    }

    start();
    return () => { mounted = false; if (intervalId) clearInterval(intervalId); };
  }, []);

  const pull = useCallback(async (): Promise<GitPullResult | null> => {
    setPulling(true);
    setPullResult(null);
    try {
      const res = await fetch('/api/git-sync/pull', { method: 'POST' });
      const json = await res.json();
      const result = json.data as GitPullResult;
      setPullResult(result);

      if (result.restartTriggered) {
        // Poll /health until server returns, then reload page
        const pollHealth = setInterval(async () => {
          try {
            const h = await fetch('/health');
            if (h.ok) { clearInterval(pollHealth); window.location.reload(); }
          } catch { /* still restarting */ }
        }, 2000);
      } else {
        // Re-check status immediately
        try {
          const sr = await fetch('/api/git-sync/status');
          const sj = await sr.json();
          if (sj.status === 'ok') setStatus(sj.data);
        } catch { /* ignore */ }
      }
      return result;
    } catch { return null; } finally { setPulling(false); }
  }, []);

  const clearPullResult = useCallback(() => setPullResult(null), []);

  return { status, pulling, pullResult, pull, clearPullResult };
}
```

### UI: Sync Pill (Header Indicator)

A compact pill in the app header. Color-coded by state. Clickable when action is available.

```typescript
// client/src/components/SyncPill.tsx
import { useState } from 'react';
import { useGitSync } from '../hooks/useGitSync.js';
import SyncModal from './SyncModal.js';
import type { GitSyncStatus } from '@scope/shared';

interface PillStyle { bg: string; text: string; label: string; animation?: string; }

function getPillStyle(status: GitSyncStatus, pulling: boolean): PillStyle {
  if (pulling) return { bg: 'bg-amber-500/15', text: 'text-amber-700', label: 'Pulling\u2026' };
  switch (status.state) {
    case 'clean':   return { bg: 'bg-green-600/15', text: 'text-green-700', label: 'Synced' };
    case 'behind':  return { bg: 'bg-amber-500', text: 'text-white', label: `${status.behind} behind`, animation: 'sync-pulse' };
    case 'dirty':   return { bg: 'bg-red-500/15', text: 'text-red-700', label: 'Dirty' };
    case 'ahead':   return { bg: 'bg-blue-500/15', text: 'text-blue-700', label: `${status.ahead} ahead` };
    case 'diverged':return { bg: 'bg-purple-500/15', text: 'text-purple-700', label: 'Diverged' };
    case 'error':   return { bg: 'bg-muted-foreground/10', text: 'text-muted-foreground', label: 'Sync error' };
    default:        return { bg: 'bg-muted-foreground/10', text: 'text-muted-foreground', label: 'Unknown' };
  }
}

export default function SyncPill() {
  const { status, pulling, pullResult, pull, clearPullResult } = useGitSync();
  const [modalOpen, setModalOpen] = useState(false);

  if (!status) return null;

  const style = getPillStyle(status, pulling);
  const clickable = status.state === 'behind' || status.state === 'diverged';

  return (
    <>
      <button
        onClick={() => clickable && (clearPullResult(), setModalOpen(true))}
        title={clickable ? undefined : `Branch: ${status.branch} | Local: ${status.localCommit}`}
        className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text} ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
        style={style.animation ? { animation: `${style.animation} 2s ease-in-out infinite` } : undefined}
      >
        {pulling && (
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {style.label}
      </button>
      <SyncModal isOpen={modalOpen} onClose={() => { setModalOpen(false); clearPullResult(); }}
        status={status} onPull={pull} pulling={pulling} pullResult={pullResult} />
    </>
  );
}
```

**CSS animation** (add to `client/src/styles/index.css`):
```css
@keyframes sync-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

### UI: Sync Modal (Pull Confirmation)

Shows commit list, confirms pull, displays result, auto-closes on success. Prevents dismissal during pull.

```typescript
// client/src/components/SyncModal.tsx
import type { GitSyncStatus, GitPullResult } from '@scope/shared';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: GitSyncStatus;
  onPull: () => void;
  pulling: boolean;
  pullResult: GitPullResult | null;
}

function relativeTime(dateStr: string): string {
  const diffSec = Math.round((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

export default function SyncModal({ isOpen, onClose, status, onPull, pulling, pullResult }: SyncModalProps) {
  if (!isOpen) return null;

  const commits = status.behindCommits ?? [];
  const isSuccess = pullResult?.success === true;
  const isFailure = pullResult?.success === false;

  if (isSuccess) setTimeout(onClose, 3000);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget && !pulling) onClose(); }}>
      <div className="bg-card rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Pull {status.behind} commit{status.behind !== 1 ? 's' : ''}?
        </h2>

        {/* Commit list (before pull) */}
        {commits.length > 0 && !pullResult && (
          <ul className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {commits.slice(0, 10).map((c) => (
              <li key={c.sha} className="text-sm border-b border-border pb-2 last:border-0">
                <div className="flex items-baseline gap-2">
                  <code className="text-xs font-mono text-primary">{c.sha}</code>
                  <span className="text-muted-foreground text-xs">{relativeTime(c.date)}</span>
                </div>
                <div className="text-foreground truncate">{c.message}</div>
                <div className="text-xs text-muted-foreground">{c.author}</div>
              </li>
            ))}
          </ul>
        )}

        {isSuccess && (
          <p className="text-green-700 text-sm mb-4">
            Pulled {pullResult.commitsPulled} commit{pullResult.commitsPulled !== 1 ? 's' : ''}.
            {pullResult.restartTriggered ? ' Server restarting\u2026' : ''}
          </p>
        )}
        {isFailure && (
          <p className="text-red-600 text-sm mb-4">{pullResult.error ?? 'Pull failed'}</p>
        )}

        <div className="flex justify-end gap-3">
          {isFailure ? (
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-muted-foreground/10 text-foreground hover:bg-muted-foreground/20">Close</button>
          ) : isSuccess ? null : (
            <>
              <button onClick={onClose} disabled={pulling} className="px-4 py-2 text-sm rounded-md bg-muted-foreground/10 text-foreground hover:bg-muted-foreground/20 disabled:opacity-50">Cancel</button>
              <button onClick={onPull} disabled={pulling} className="px-4 py-2 text-sm rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
                {pulling && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {pulling ? 'Pulling\u2026' : 'Pull Now'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Environment Configuration

Add to `server/src/config/env.ts` Zod schema:
```typescript
GIT_SYNC_POLL_MS: z.coerce.number().default(120_000),
```

Expose in `/api/info` response:
```typescript
gitSyncPollMs: env.GIT_SYNC_POLL_MS,
```

Add to `.env.example`:
```
GIT_SYNC_POLL_MS=120000
```

---

## Sub-Type B: Full Git Sync (Push + Pull)

Extends Sub-type A with push capability and conflict resolution. For apps where multiple people contribute changes.

**Discovered in**: FliHub (B044 Sync Hub)

### Additional Shared Types

```typescript
// Add to shared/src/git-sync.ts
export interface GitPushResult {
  success: boolean;
  commitMessage: string;
  filesCommitted: number;
  error?: string;
}

export interface ConflictFile {
  path: string;
  resolved: boolean;
}

export interface GitResolveResult {
  success: boolean;
  remaining: number;
  error?: string;
}
```

### Additional Server Service Methods

Add to `git-sync.service.ts`:

```typescript
export function pushChanges(message?: string): Promise<GitPushResult> {
  return withGitLock(async (): Promise<GitPushResult> => {
    const porcelain = await git(['status', '--porcelain'], 5_000);
    if (porcelain.length === 0) {
      return { success: false, commitMessage: '', filesCommitted: 0, error: 'Nothing to commit' };
    }

    const files = porcelain.split('\n').filter(Boolean);
    const commitMessage = message || buildCommitMessage(files);

    await git(['add', '-A'], 10_000);
    await git(['commit', '-m', commitMessage], 30_000);

    try {
      await git(['push'], 60_000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, commitMessage, filesCommitted: files.length, error: `Push failed: ${msg}` };
    }

    return { success: true, commitMessage, filesCommitted: files.length };
  });
}

export function resolveConflict(filePath: string, strategy: 'keep-mine' | 'keep-theirs'): Promise<GitResolveResult> {
  return withGitLock(async (): Promise<GitResolveResult> => {
    // Path traversal guard
    if (filePath.includes('..') || path.isAbsolute(filePath)) {
      return { success: false, remaining: -1, error: 'Invalid file path' };
    }

    const flag = strategy === 'keep-mine' ? '--ours' : '--theirs';
    await git(['checkout', flag, '--', filePath], 10_000);
    await git(['add', filePath], 5_000);

    // Count remaining conflicts
    const status = await git(['status', '--porcelain'], 5_000);
    const remaining = status.split('\n').filter(l => l.startsWith('UU') || l.startsWith('AA')).length;

    if (remaining === 0) {
      // All conflicts resolved — continue rebase
      try { await git(['rebase', '--continue'], 30_000); } catch { /* may need more resolves */ }
    }

    return { success: true, remaining };
  });
}

function buildCommitMessage(files: string[]): string {
  const types = new Map<string, number>();
  for (const f of files) {
    const ext = path.extname(f.slice(3).trim()) || 'other';
    types.set(ext, (types.get(ext) || 0) + 1);
  }
  const summary = [...types.entries()].map(([ext, n]) => `${n} ${ext}`).join(', ');
  return `sync: ${files.length} file${files.length !== 1 ? 's' : ''} (${summary})`;
}
```

### Additional Server Routes

```typescript
// Add to git-sync.ts router
router.post('/push', async (req, res) => {
  try {
    const message = req.body?.message as string | undefined;
    const result = await pushChanges(message);
    return apiSuccess(res, result);
  } catch (err) {
    logger.error({ err }, 'git-sync push failed');
    return apiFailure(res, 'Git push failed', 500);
  }
});

router.post('/resolve', async (req, res) => {
  try {
    const { filePath, strategy } = req.body as { filePath: string; strategy: 'keep-mine' | 'keep-theirs' };
    if (!filePath || !strategy) return apiFailure(res, 'filePath and strategy required', 400);
    const result = await resolveConflict(filePath, strategy);
    return apiSuccess(res, result);
  } catch (err) {
    logger.error({ err }, 'git-sync resolve failed');
    return apiFailure(res, 'Conflict resolution failed', 500);
  }
});
```

### Additional Client: Push + Conflict UI

The push flow adds:
1. A "Push" button in the sync modal (visible when state is `dirty` or `ahead`)
2. A confirmation step showing changed files grouped by type
3. A conflict resolution panel when pull results in rebase conflicts

These are more complex components — see FliHub's `SyncTool.tsx` for the full pattern. Key UX principles:

- **Push confirmation modal**: Show file count, grouped file list (collapsible by type), auto-generated commit message (editable), Cancel/Push buttons
- **Conflict panel**: List conflicting files, per-file "Keep mine" / "Keep theirs" buttons, remaining conflict count
- **Role gating**: If `add-auth` is applied, gate push behind an admin or developer role

---

## Sub-Type C: Git Data Commit

For apps using `file-crud` where data lives in `data/` as JSON files. This sub-type lets users commit their data changes to git and optionally push them.

**Discovered in**: Signal Studio (Git Sync Button)

### Server Routes

```typescript
// server/src/routes/git-data.ts
import { Router } from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'path';
import { apiSuccess, apiFailure } from '../helpers/response.js';

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(process.cwd(), '..');
const DATA_DIR = 'data'; // relative to REPO_ROOT

async function git(args: string[], timeoutMs = 15_000): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: REPO_ROOT, timeout: timeoutMs,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return stdout.trim();
}

const router = Router();

// What data files have changed?
router.get('/status', async (_req, res) => {
  try {
    const output = await git(['status', DATA_DIR, '--porcelain', '-u']);
    const files = output ? output.split('\n').filter(Boolean) : [];
    return apiSuccess(res, { dirty: files.length > 0, files });
  } catch (err) {
    return apiFailure(res, 'Git status check failed', 500);
  }
});

// Commit data changes + push
let syncInProgress = false;

router.post('/sync', async (_req, res) => {
  if (syncInProgress) return apiFailure(res, 'Sync already in progress', 409);
  syncInProgress = true;

  try {
    await git(['add', DATA_DIR], 10_000);
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await git(['commit', '-m', `data: sync ${timestamp}`], 30_000);

    // Stash non-data changes, fetch, rebase, push, restore
    let stashed = false;
    const nonDataChanges = await git(['status', '--porcelain', '-u']);
    if (nonDataChanges.length > 0) {
      await git(['stash', 'push', '--include-untracked'], 10_000);
      stashed = true;
    }

    try {
      await git(['fetch', '--quiet'], 15_000);
      await git(['rebase', 'origin/main'], 60_000);
      await git(['push'], 60_000);
    } catch (err) {
      // Abort rebase, restore stash
      try { await git(['rebase', '--abort'], 10_000); } catch { /* clean */ }
      if (stashed) try { await git(['stash', 'pop'], 10_000); } catch { /* manual */ }
      const message = err instanceof Error ? err.message : String(err);
      return apiFailure(res, `Sync failed: ${message}`, 500);
    }

    if (stashed) await git(['stash', 'pop'], 10_000);
    return apiSuccess(res, { message: 'Data synced to Git' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiFailure(res, message, 500);
  } finally {
    syncInProgress = false;
  }
});

// Check remote status (behind/ahead)
router.get('/remote-status', async (_req, res) => {
  try {
    await git(['fetch', '--quiet'], 15_000);
    const revList = await git(['rev-list', '--left-right', '--count', 'HEAD...origin/main']);
    const [aheadStr, behindStr] = revList.split(/\s+/);
    return apiSuccess(res, { behind: parseInt(behindStr, 10) || 0, ahead: parseInt(aheadStr, 10) || 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiSuccess(res, { behind: 0, ahead: 0, error: message });
  }
});

export { router as gitDataRouter };
```

Mount: `app.use('/api/git', gitDataRouter);`

### Client: Data Sync Button (Header)

A cloud icon with pulsing amber dot when data files are dirty. Click opens a dropdown showing changed files with friendly names.

**Key UX patterns from Signal Studio:**
- Parse file paths to show domain-friendly names: `data/companies/sunrise-abc123.json` → "Company: Sunrise Care" (Modified)
- Color-coded git status: Modified (amber), Added (green), Deleted (red), New/Untracked (blue)
- "Commit to Git" button — one-click commit + push of data folder
- "Check remote" button — shows behind/ahead count
- Separate from code sync — users understand "my data changes" vs "app updates"

### Per-Entity Sync Badge

For detail views — shows whether an individual record has been pushed to a remote system.

```typescript
// client/src/components/SyncStatusBadge.tsx
interface SyncStatusBadgeProps {
  supportsignalId?: string;  // or any remote system ID field
  lastPushedAt?: string;
  updatedAt?: string;
}

type SyncState = 'never' | 'stale' | 'synced';

const styles: Record<SyncState, { bg: string; text: string; dot: string; label: string }> = {
  never:  { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444', label: 'Not pushed' },
  stale:  { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b', label: 'Changed since push' },
  synced: { bg: '#f0fdf4', text: '#166534', dot: '#22c55e', label: 'In sync' },
};

export default function SyncStatusBadge({ supportsignalId, lastPushedAt, updatedAt }: SyncStatusBadgeProps) {
  let state: SyncState = 'never';
  if (supportsignalId && lastPushedAt) {
    state = updatedAt && new Date(updatedAt) > new Date(lastPushedAt) ? 'stale' : 'synced';
  }

  const s = styles[state];
  const title = state === 'synced' ? `Last pushed: ${new Date(lastPushedAt!).toLocaleString()}` :
                state === 'stale' ? 'Edited after last push' : 'Never pushed';

  return (
    <span title={title} style={{ background: s.bg, color: s.text }}
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium">
      <span style={{ background: s.dot }} className="w-1.5 h-1.5 rounded-full" />
      {s.label}
    </span>
  );
}
```

---

## Sub-Type D: Shared Folder Sync

For data that syncs via Dropbox, Syncthing, or similar — no Git involved. The app watches a folder for incoming changes and exposes UI to review and accept them.

**Discovered in**: FliHub (Relay System)

### Architecture

```
Machine A (David)                     Machine B (Angela)
  app writes to data/     ──┐
                             ├── Dropbox / Syncthing ──► relay/ folder
  app reads relay/ folder ◄──┘                           app watches relay/ folder
```

The app does NOT manage the sync mechanism (Dropbox/Syncthing handles that). The app only:
1. Watches a designated folder for changes (chokidar)
2. Detects divergence between local `data/` and incoming `relay/` folder
3. Shows the user what's different
4. Lets the user accept incoming changes (copy relay → data)

### Server Service

```typescript
// server/src/services/folder-sync.service.ts
import fs from 'fs/promises';
import path from 'path';
import { watch } from 'chokidar';
import { logger } from '../config/logger.js';

const DATA_ROOT = process.env.DATA_DIR ?? path.resolve(process.cwd(), '..', 'data');
const RELAY_ROOT = process.env.RELAY_DIR ?? path.resolve(process.cwd(), '..', 'relay');

export interface FolderSyncStatus {
  configured: boolean;
  relayExists: boolean;
  incoming: FileChange[];
  outgoing: FileChange[];
}

export interface FileChange {
  relativePath: string;
  direction: 'incoming' | 'outgoing';
  type: 'added' | 'modified' | 'deleted';
  size?: number;
  modified?: string;
}

export async function getFolderSyncStatus(): Promise<FolderSyncStatus> {
  const relayExists = await fs.access(RELAY_ROOT).then(() => true, () => false);
  if (!relayExists) return { configured: false, relayExists: false, incoming: [], outgoing: [] };

  const incoming = await detectChanges(RELAY_ROOT, DATA_ROOT, 'incoming');
  const outgoing = await detectChanges(DATA_ROOT, RELAY_ROOT, 'outgoing');

  return { configured: true, relayExists: true, incoming, outgoing };
}

async function detectChanges(sourceDir: string, targetDir: string, direction: 'incoming' | 'outgoing'): Promise<FileChange[]> {
  const changes: FileChange[] = [];

  try {
    const sourceFiles = await walkDir(sourceDir);
    for (const relPath of sourceFiles) {
      const sourceStat = await fs.stat(path.join(sourceDir, relPath));
      try {
        const targetStat = await fs.stat(path.join(targetDir, relPath));
        if (sourceStat.mtimeMs > targetStat.mtimeMs) {
          changes.push({ relativePath: relPath, direction, type: 'modified', size: sourceStat.size, modified: sourceStat.mtime.toISOString() });
        }
      } catch {
        changes.push({ relativePath: relPath, direction, type: 'added', size: sourceStat.size, modified: sourceStat.mtime.toISOString() });
      }
    }
  } catch { /* source dir empty or unreadable */ }

  return changes;
}

async function walkDir(dir: string, base = dir): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) paths.push(...await walkDir(full, base));
    else paths.push(path.relative(base, full));
  }
  return paths;
}

export async function acceptIncoming(relativePath: string): Promise<void> {
  // Path traversal guard
  if (relativePath.includes('..') || path.isAbsolute(relativePath)) throw new Error('Invalid path');

  const source = path.join(RELAY_ROOT, relativePath);
  const target = path.join(DATA_ROOT, relativePath);

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

export async function acceptAllIncoming(): Promise<number> {
  const status = await getFolderSyncStatus();
  let count = 0;
  for (const change of status.incoming) {
    if (change.type !== 'deleted') {
      await acceptIncoming(change.relativePath);
      count++;
    }
  }
  return count;
}
```

### Server Routes

```typescript
// server/src/routes/folder-sync.ts
import { Router } from 'express';
import { getFolderSyncStatus, acceptIncoming, acceptAllIncoming } from '../services/folder-sync.service.js';
import { apiSuccess, apiFailure } from '../helpers/response.js';

const router = Router();

router.get('/status', async (_req, res) => {
  try {
    const status = await getFolderSyncStatus();
    return apiSuccess(res, status);
  } catch (err) {
    return apiFailure(res, 'Folder sync status failed', 500);
  }
});

router.post('/accept', async (req, res) => {
  try {
    const { path: filePath } = req.body;
    if (filePath) {
      await acceptIncoming(filePath);
      return apiSuccess(res, { accepted: 1 });
    } else {
      const count = await acceptAllIncoming();
      return apiSuccess(res, { accepted: count });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiFailure(res, message, 500);
  }
});

export { router as folderSyncRouter };
```

Mount: `app.use('/api/folder-sync', folderSyncRouter);`

### Environment

```
RELAY_DIR=../relay   # path to shared folder (Dropbox, Syncthing, etc.)
```

---

## Edge Cases & Gotchas (From Real Production Experience)

### Git Operations

1. **Never use `exec()` for git commands** — always `execFile()`. Shell injection via crafted branch names or commit messages is a real risk.

2. **Always set `GIT_TERMINAL_PROMPT=0`** — without this, git may hang forever waiting for SSH credentials or GPG passphrase on a headless server.

3. **Always use the mutex lock** — poll-check and pull can race. The promise-chain mutex serialises all git operations without blocking the event loop.

4. **`git fetch` failure is non-fatal** — network may be temporarily down. Return an `error` state but don't crash. The next poll will retry.

5. **`git pull --rebase` vs `git pull --merge`** — rebase keeps linear history (cleaner for data-only repos). But on conflict, you must handle `rebase --abort`. Never leave a repo in mid-rebase state.

6. **Dirty tree blocks pull** — always check `git status --porcelain` before attempting pull. A pull on a dirty tree leads to unpredictable merge behaviour. Show the user: "You have unsaved changes — commit or discard before pulling."

7. **Stash non-data changes during data sync** — if code and data are in the same repo, stash code changes before rebasing for data push, then restore. Signal Studio does this. Without it, code changes get caught up in the data commit.

8. **Concurrent sync prevention** — use a boolean flag (`syncInProgress`) to prevent a second sync while the first is running. Return 409 Conflict.

### Process Management

9. **Overmind-aware restart** — after pulling code changes, the server needs to restart to pick up new code. Check for `OVERMIND_SOCKET` env var. If present, `process.exit(0)` after a 2-second delay lets the response reach the client before the server dies. Overmind auto-restarts.

10. **Client-side health polling after restart** — after a pull that triggers restart, poll `/health` every 2 seconds. When it returns 200, reload the page. This gives seamless "pull → restart → reload" UX.

11. **Without Overmind** — if no process manager, the server stays running after pull. New code only takes effect on next manual restart. The modal should say "Pulled N commits. Restart the server to apply changes."

### UI/UX

12. **Auto-close success modal** — 3-second delay then close. Don't make users click "OK" on success.

13. **Prevent modal dismiss during pull** — disable backdrop click and Cancel button while pulling. A dismissed modal during an in-flight pull creates orphan state.

14. **Relative time for commits** — "5m ago" is more useful than "2026-03-28T17:20:00Z". Parse ISO dates to relative time in the modal.

15. **Pill animation draws attention without alarm** — the `sync-pulse` (opacity 1→0.6→1 over 2s) is noticeable but not stressful. Solid color + animation for actionable states (behind), transparent color + no animation for informational states (clean, ahead).

16. **Non-developer language** — "3 behind" means nothing to Angela. Consider: "Update available" (behind), "Your changes haven't been shared" (dirty), "Everything up to date" (clean). Decide this during the routing questions.

17. **Separate data sync from code sync visually** — Signal Studio uses two different UI elements: GitSyncButton (cloud icon, header) for data commits, and a separate mechanism for code updates. Users understand "my data" vs "the app" as two different things.

18. **Don't show SHA hashes to non-developers** — commit SHAs are noise. Show commit messages only, or better, translate to domain language ("Added company: Sunrise Care").

### Shared Folder Sync

19. **Never sync `.git/` directories via Dropbox/Syncthing** — the Syncthing project explicitly warns against this. It corrupts git state.

20. **File write races** — Dropbox/Syncthing may deliver a partially-written file. Consider a debounce (500ms–1s) after detecting a change before reading the file.

21. **Conflict files** — Dropbox creates `filename (conflicted copy)` files. Syncthing creates `.sync-conflict-*` files. The app should detect and surface these rather than silently ignoring them.

22. **Large files** — git is wrong for video, images, and other large binaries. Shared folder sync (Sub-type D) is the right choice. Don't mix patterns.

---

## What to Generate in the Build Prompt

After routing questions, collect:

1. **Sub-type(s)** — which combination (A, B, C, D)?
2. **Poll interval** — how often to check for updates? (default: 120s)
3. **Language style** — developer, plain English, or custom labels for each state?
4. **Restart behaviour** — Overmind-aware restart or manual?
5. **Data folder path** — if Sub-type C, what path? (default: `data/`)
6. **Relay folder path** — if Sub-type D, what path? (default: `relay/`)
7. **Role gating** — if Sub-type B, who can push? Everyone or admin-only?
8. **Existing infrastructure** — is `file-crud` applied? Is there a header component to mount the pill in?
9. **Entity-level badges** — if Sub-type C, should detail views show per-entity sync status badges? What field names for remote ID and last-pushed timestamp?

Then generate a concrete build prompt with real file paths, component names, and configuration values.

---

## When to Use This Recipe

| Scenario | Sub-type |
|----------|----------|
| David pushes code, Angela/Lars pull via UI | A (pull-only) |
| Two developers collaborating on same app | B (full push + pull) |
| App stores data as JSON files, needs to commit + push data changes | C (git data commit) |
| Sharing data between machines via Dropbox/Syncthing | D (shared folder) |
| Signal Studio pattern (data commit + code pull) | A + C |
| FliHub pattern (full sync + file relay) | B + D |
| AngelEye pattern (simple pull-only) | A |
| Solo developer, CLI only | Don't need this recipe — use `/push` skill |

---

## Alternatives and Related Recipes

| Recipe | When to use instead |
|--------|-------------------|
| `api-endpoints` | When data needs to sync via HTTP API to a different application (not same codebase) |
| `file-crud` | Prerequisite for Sub-type C — provides the JSON file persistence layer |
| `add-auth` | Add before Sub-type B if push operations need role-gating |
| `local-service` | Provides Overmind integration that Sub-type A's restart logic depends on |
