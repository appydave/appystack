import { mkdirSync, cpSync, symlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SKIP = new Set(['node_modules', 'dist', 'coverage', 'test-results', '.git']);

// create-appystack/template/ is a synced copy that git only half tracks (.vscode is ignored), so a
// clean checkout cannot scaffold from it. Build the shipped layout in a scratch tree instead: copy the
// real template/ and the CLI, run the real sync script, and return the path of the CLI to scaffold with.
export function buildPackage(root) {
  const pkg = join(root, 'create-appystack');
  mkdirSync(pkg);
  for (const dir of ['bin', 'scripts']) cpSync(join(PKG, dir), join(pkg, dir), { recursive: true });
  cpSync(join(PKG, 'package.json'), join(pkg, 'package.json'));
  symlinkSync(join(PKG, 'node_modules'), join(pkg, 'node_modules'));
  cpSync(join(PKG, '../template'), join(root, 'template'), {
    recursive: true,
    filter: (p) => !SKIP.has(p.split('/').pop()),
  });
  const sync = spawnSync(process.execPath, [join(pkg, 'scripts/sync-template.js')], { encoding: 'utf-8' });
  if (sync.status !== 0) throw new Error(`sync failed: ${sync.stderr}`);
  return join(pkg, 'bin/index.js');
}
