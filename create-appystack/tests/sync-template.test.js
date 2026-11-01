import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = new URL('../scripts/sync-template.js', import.meta.url).pathname;

// The script resolves ../../template and ../template from its own location,
// so a copy placed in a scratch tree syncs the scratch template, not the repo's.
function syncScratch() {
  const root = mkdtempSync(join(tmpdir(), 'sync-template-'));
  mkdirSync(join(root, 'create-appystack/scripts'), { recursive: true });
  copyFileSync(SCRIPT, join(root, 'create-appystack/scripts/sync-template.js'));
  const put = (rel) => {
    mkdirSync(join(root, 'template', rel, '..'), { recursive: true });
    writeFileSync(join(root, 'template', rel), 'x');
  };
  ['package.json', 'package-lock.json', 'client/tsconfig.tsbuildinfo', 'client/src/a.ts'].forEach(put);
  execFileSync('node', [join(root, 'create-appystack/scripts/sync-template.js')]);
  return { out: (rel) => existsSync(join(root, 'create-appystack/template', rel)), done: () => rmSync(root, { recursive: true }) };
}

describe('sync-template', () => {
  it('leaves out lockfiles and tsbuildinfo at any depth, still copies normal files', () => {
    const t = syncScratch();
    expect(t.out('package-lock.json')).toBe(false);
    expect(t.out('client/tsconfig.tsbuildinfo')).toBe(false);
    expect(t.out('package.json')).toBe(true);
    expect(t.out('client/src/a.ts')).toBe(true);
    t.done();
  });
});
