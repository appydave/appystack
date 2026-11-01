import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

// Folders the lint script and the linters leave alone. The tree is walked, not read from git, so an
// unmodified scaffold with no repository (or a repository with no commit) passes these tests too.
const SKIPPED = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  '.claude',
  '.git',
]);

export function treeFiles(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED.has(entry.name)) {
      return [];
    }

    const path = join(dir, entry.name);

    return entry.isDirectory() ? treeFiles(path, base) : [relative(base, path)];
  });
}
