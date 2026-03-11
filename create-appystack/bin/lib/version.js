// WU02: appystack.json detection, scaffold commit scan, prompt fallback
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCAFFOLD_PATTERNS = [
  'chore: initial scaffold from create-appystack',
  'chore: scaffold appystack into existing project',
];

// ---------------------------------------------------------------------------
// readAppystackJson(consumerDir)
// Read appystack.json from consumerDir root.
// Returns parsed object if exists, null if not found or on any error.
// ---------------------------------------------------------------------------

export function readAppystackJson(consumerDir) {
  try {
    const filePath = join(consumerDir, 'appystack.json');
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// detectScaffoldInfo(consumerDir)
// Returns { version, scaffoldCommit, source } where source is
// 'file', 'git', or 'prompt'.
//
// Priority:
//   1. appystack.json present → source: 'file'
//   2. Scan git log for scaffold commit message → source: 'git'
//   3. Nothing found → source: 'prompt' (caller handles user prompt)
// ---------------------------------------------------------------------------

export function detectScaffoldInfo(consumerDir) {
  // 1. Try appystack.json
  const json = readAppystackJson(consumerDir);
  if (json) {
    return {
      version: json.version ?? null,
      scaffoldCommit: json.scaffoldCommit ?? null,
      source: 'file',
    };
  }

  // 2. Scan git log
  try {
    const output = execSync('git log --oneline --all', {
      cwd: consumerDir,
      stdio: 'pipe',
    }).toString('utf-8');

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Format: "<sha> <message>"
      const spaceIdx = trimmed.indexOf(' ');
      if (spaceIdx === -1) continue;
      const sha = trimmed.slice(0, spaceIdx);
      const message = trimmed.slice(spaceIdx + 1);
      if (SCAFFOLD_PATTERNS.some((p) => message.includes(p))) {
        console.warn(
          `[appystack] scaffold version inferred as 0.3.0 from git commit ${sha} — no appystack.json found.`
        );
        return { version: '0.3.0', scaffoldCommit: sha, source: 'git' };
      }
    }
  } catch {
    // git not available or not a git repo — fall through
  }

  // 3. Nothing found — caller must prompt
  return { version: null, scaffoldCommit: null, source: 'prompt' };
}

// ---------------------------------------------------------------------------
// writeAppystackJson(consumerDir, { version, scaffoldCommit })
// Write (or overwrite) appystack.json in consumerDir.
// Always sets lastUpgrade to today (YYYY-MM-DD) and templatePath to null.
// Returns the written object.
// ---------------------------------------------------------------------------

export function writeAppystackJson(consumerDir, { version, scaffoldCommit }) {
  const record = {
    version,
    scaffoldCommit,
    lastUpgrade: new Date().toISOString().split('T')[0],
    templatePath: null,
  };
  const filePath = join(consumerDir, 'appystack.json');
  writeFileSync(filePath, JSON.stringify(record, null, 2) + '\n', 'utf-8');
  return record;
}

// ---------------------------------------------------------------------------
// @test — example usage (commented out, for reference only)
//
// import { readAppystackJson, detectScaffoldInfo, writeAppystackJson, SCAFFOLD_PATTERNS } from './version.js';
//
// const info = detectScaffoldInfo('/path/to/consumer-app');
// // { version: '0.3.0', scaffoldCommit: 'abc1234', source: 'file' | 'git' | 'prompt' }
//
// const written = writeAppystackJson('/path/to/consumer-app', { version: '0.3.0', scaffoldCommit: 'abc1234' });
// // { version: '0.3.0', scaffoldCommit: 'abc1234', lastUpgrade: '2026-03-11', templatePath: null }
//
// console.log(SCAFFOLD_PATTERNS);
// // ['chore: initial scaffold from create-appystack', 'chore: scaffold appystack into existing project']
// ---------------------------------------------------------------------------
