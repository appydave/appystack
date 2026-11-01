import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { buildPackage } from './helpers/build-package.js';

// A scaffolded app is not the template: the CLI renames, rewrites and drops files. The template's CI
// cannot see a test that only breaks after that, so scaffold from the current template and run the
// new app's own suite. Needs the network (the scaffold's own `npm install`).
const MINUTE = 60 * 1000;
const INSTALL_AND_SCAFFOLD_MS = 5 * MINUTE;
const SUITE_MS = 5 * MINUTE;
const APP = 'suite-app';

const run = (cwd, command, args, timeout) =>
  spawnSync(command, args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout });
const output = (result) => `${result.stdout}\n${result.stderr}`;

describe('a scaffolded app passes its own suite', () => {
  let pkgRoot;
  let work;
  let app;
  beforeAll(() => {
    pkgRoot = mkdtempSync(join(tmpdir(), 'suite-pkg-'));
    work = mkdtempSync(join(tmpdir(), 'suite-work-'));
    app = join(work, APP);
    const bin = buildPackage(pkgRoot);
    const scaffold = run(
      work,
      process.execPath,
      [
        bin,
        APP,
        '--yes',
        '--no-github',
        '--scope',
        '@suite',
        '--port',
        '5700',
        '--server-port',
        '5701',
        '--description',
        'suite',
      ],
      INSTALL_AND_SCAFFOLD_MS,
    );

    expect(scaffold.status, output(scaffold)).toBe(0);
  }, INSTALL_AND_SCAFFOLD_MS);
  afterAll(() => {
    for (const dir of [pkgRoot, work]) {
      if (!resolve(dir).startsWith(resolve(tmpdir()) + '/')) throw new Error(`refusing to remove ${dir}`);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it(
    'builds shared, typechecks and passes npm test',
    () => {
      // Build shared first: a fresh scaffold's `npm test` and typecheck fail (unresolved `@scope/shared`,
      // TS2307) until `npm run build -w shared` runs. A known 0.5.1 gap, parked for 0.5.3 (pretest and
      // pretypecheck hooks); remove this build step when that lands.
      const built = run(app, 'npm', ['run', 'build', '-w', 'shared'], SUITE_MS);
      const typecheck = run(app, 'npm', ['run', 'typecheck'], SUITE_MS);
      const tests = run(app, 'npm', ['test'], SUITE_MS);

      expect(built.status, output(built)).toBe(0);
      expect(typecheck.status, output(typecheck)).toBe(0);
      expect(tests.status, output(tests).slice(-4000)).toBe(0);
    },
    SUITE_MS * 3,
  );
});
