/**
 * Audit helpers for merge mode — determines which template files already exist
 * in the target directory (keep) and which will be newly added (add).
 *
 * Extracted as pure functions so they are independently testable.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

// Files that applyCustomizations patches with port/scope/name substitutions.
// If any of these already exist in the target they won't be overwritten,
// so substitutions won't apply — the user needs to know.
export const KEY_TEMPLATE_FILES = [
  'package.json',
  'README.md',
  '.env.example',
  'shared/package.json',
  'server/package.json',
  'client/package.json',
  'server/src/config/env.ts',
  'client/vite.config.ts',
  'client/index.html',
];

const SMALL_PROJECT_THRESHOLD = 25;

/**
 * Walk the template directory and categorise every file as 'keep' (already
 * exists in target) or 'add' (new from template).
 *
 * @param {string} targetDir   - the existing project directory
 * @param {string} templateDir - the template source directory
 * @param {(src: string) => boolean} filter - same filter used by cpSync
 * @returns {{ kept: string[], added: string[], keyFilesKept: string[] }}
 */
export function buildAudit(targetDir, templateDir, filter) {
  const kept = [];
  const added = [];

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      if (!filter(full)) continue;
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else {
        const rel = relative(templateDir, full);
        const destExists = existsSync(join(targetDir, rel));
        if (destExists) {
          kept.push(rel);
        } else {
          added.push(rel);
        }
      }
    }
  }

  walk(templateDir);

  const keyFilesKept = KEY_TEMPLATE_FILES.filter(f => kept.includes(f));

  return { kept, added, keyFilesKept };
}

/**
 * Render the audit as a string suitable for a @clack/prompts note() block.
 * Small projects (few existing files) get a tree-style view.
 * Large projects get a directory-level summary.
 *
 * @param {{ kept: string[], added: string[], keyFilesKept: string[] }} audit
 * @param {string} projectName
 * @param {string} targetDir
 * @returns {string}
 */
export function renderAudit(audit, projectName, targetDir) {
  if (audit.kept.length <= SMALL_PROJECT_THRESHOLD) {
    return renderSmallAudit(audit, projectName, targetDir);
  }
  return renderLargeAudit(audit, projectName, targetDir);
}

// ---------------------------------------------------------------------------
// Small project — tree view with inline [keep] / [add] tags
// ---------------------------------------------------------------------------

function renderSmallAudit({ kept, added, keyFilesKept }, projectName, targetDir) {
  const lines = [`  ${projectName}/`];

  // Existing files — show each one
  for (const f of kept) {
    lines.push(`  ├── ${f.padEnd(44)} [keep]`);
  }

  // Added items — group into top-level dirs and lone files
  const addedDirs = groupByTopDir(added);
  for (const [key, files] of Object.entries(addedDirs)) {
    if (key === '__root__') {
      for (const f of files) {
        lines.push(`  ├── ${f.padEnd(44)} [add]`);
      }
    } else {
      lines.push(`  ├── ${key}/`.padEnd(49) + `[add — ${files.length} files]`);
    }
  }

  lines.push('');
  lines.push(`  ${kept.length} kept  ·  ${added.length} added`);

  if (keyFilesKept.length > 0) {
    lines.push('');
    lines.push('  ⚠  These template files already exist and will not be patched');
    lines.push('     (port, scope, and name substitutions will not apply to them):');
    for (const f of keyFilesKept) {
      lines.push(`     ${f}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Large project — directory-level summary table
// ---------------------------------------------------------------------------

function renderLargeAudit({ kept, added, keyFilesKept }, projectName, targetDir) {
  const lines = [`  Existing project: ${projectName}`];
  lines.push('  ' + '─'.repeat(52));

  const keptByDir = groupByTopDir(kept);
  const addedByDir = groupByTopDir(added);
  const allDirs = new Set([...Object.keys(keptByDir), ...Object.keys(addedByDir)]);

  for (const dir of allDirs) {
    const k = (keptByDir[dir] || []).length;
    const a = (addedByDir[dir] || []).length;
    const label = dir === '__root__' ? 'root' : `${dir}/`;
    const keptStr = k > 0 ? `[keep ${k}]` : '';
    const addStr = a > 0 ? `[add ${a}]` : '';
    lines.push(`  ${label.padEnd(20)} ${keptStr.padEnd(10)} ${addStr}`);
  }

  lines.push('  ' + '─'.repeat(52));
  lines.push(`  ${kept.length} kept  ·  ${added.length} added`);

  if (keyFilesKept.length > 0) {
    lines.push('');
    lines.push('  ⚠  Key template files already exist (kept as-is):');
    lines.push('     Port, scope, and name substitutions will not apply to them.');
    lines.push(`     ${keyFilesKept.join(' · ')}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Group an array of relative file paths by their top-level directory segment.
 * Files at the root (no directory component) are grouped under '__root__'.
 *
 * @param {string[]} files
 * @returns {Record<string, string[]>}
 */
export function groupByTopDir(files) {
  const groups = {};
  for (const f of files) {
    const parts = f.split('/');
    const key = parts.length === 1 ? '__root__' : parts[0];
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }
  return groups;
}
