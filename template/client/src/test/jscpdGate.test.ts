// @vitest-environment node
// Runs the jscpd binary in temp trees, which needs node's child_process and fs.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// vitest runs with the client workspace as cwd; the configs sit one level up, at the template root.
const root = resolve(process.cwd(), '..');
const JSCPD = resolve(root, 'node_modules/.bin/jscpd');
const SCOPE = ['client', 'server', 'shared', 'scripts', 'lint', 'e2e'];
const FORMATS = ['typescript', 'tsx', 'javascript', 'jsx'];
const OUTPUT_DIRS = ['**/node_modules/**', '**/dist/**', '**/coverage/**'];
const TYPES = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts'];
const TEST_TYPES = `{${TYPES.join(',')}}`;
// Built from parts so this file does not contain the marker it forbids (the guard scans it too).
const MARKER = ['jscpd', 'ignore'].join(':');
const SKIP_DIRS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  '.claude',
];
const PROD_CONFIG = '.jscpd.json';
const TESTS_CONFIG = '.jscpd.tests.json';

const readJson = (file: string): unknown => JSON.parse(readFileSync(resolve(root, file), 'utf8'));

// The whole config of each profile, key for key. Loosening any value (a lower minimum, a missing
// ignore, a wider test pattern, no threshold) switches a gate off while every other test stays green.
const PROD_PROFILE = {
  path: SCOPE,
  format: FORMATS,
  minLines: 5,
  minTokens: 50,
  threshold: 0,
  reporters: ['console'],
  ignore: [...OUTPUT_DIRS, '**/*.test.*', '**/*.spec.*', '**/test/**', '**/e2e/**'],
};
const TESTS_PROFILE = {
  path: SCOPE,
  format: FORMATS,
  minLines: 10,
  minTokens: 100,
  threshold: 0,
  reporters: ['console'],
  pattern: `**/{*.{test,spec}.${TEST_TYPES},test/**/*.${TEST_TYPES}}`,
  ignore: OUTPUT_DIRS,
};

describe('the duplicates gate configuration', () => {
  it('prod profile is exactly: 5 lines / 50 tokens, threshold 0, tests and e2e out, output folders out', () => {
    expect(
      readJson(PROD_CONFIG),
      'The prod profile changed. Restore it, or update PROD_PROFILE in this test in the same PR.'
    ).toEqual(PROD_PROFILE);
  });

  it('tests profile is exactly: 10 lines / 100 tokens, threshold 0, test and spec files plus test/ helpers', () => {
    expect(
      readJson(TESTS_CONFIG),
      'The tests profile changed. Restore it, or update TESTS_PROFILE in this test in the same PR.'
    ).toEqual(TESTS_PROFILE);
  });

  it('`npm run dup` refuses the ignore marker, then runs the prod profile, then the tests profile', () => {
    const manifest: { scripts: { dup: string } } = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8')
    );
    const include = TYPES.map((type) => `--include='*.${type}'`).join(' ');
    const exclude = SKIP_DIRS.map((dir) => `--exclude-dir=${dir}`).join(' ');

    expect(
      manifest.scripts.dup,
      'Restore the dup script: the marker guard, then both jscpd profiles.'
    ).toBe(
      `grep -rqF '${MARKER}' ${include} ${exclude} . ; [ $? -eq 1 ] && jscpd --config ${PROD_CONFIG} && jscpd --config ${TESTS_CONFIG}`
    );
  });

  it('pins jscpd to an exact version', () => {
    const manifest: { devDependencies: Record<string, string> } = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8')
    );

    expect(manifest.devDependencies.jscpd).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('CI runs `npm run dup` as a "Duplicates" step after the Lint step', () => {
    const ci = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');
    const lint = ci.indexOf('- name: Lint\n        run: npm run lint\n');
    const dup = ci.indexOf('- name: Duplicates\n        run: npm run dup\n');

    expect(lint, 'ci.yml lost its Lint step').toBeGreaterThan(-1);
    expect(
      dup,
      'Add a `Duplicates` step running `npm run dup` right after Lint in ci.yml.'
    ).toBeGreaterThan(lint);
  });
});

// A block of n distinct lines of about 13 tokens each, and a block of n short lines of 7 tokens each.
const WIDE = (n: number) =>
  Array.from({ length: n }, (_, i) => `  total += item.qty * item.price + ${i};`).join('\n');
// n distinct lines of about 20 tokens each: enough tokens that only the line count decides.
const DENSE = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => `  total += item.qty * item.price * item.rate - item.cut + ${i};`
  ).join('\n');
const NARROW = (n: number) => Array.from({ length: n }, (_, i) => `  f${i}(a, b);`).join('\n');
// Two files that share one block and differ elsewhere, so the clone is the block alone.
const pair = (a: string, b: string, block: string): Record<string, string> => ({
  [a]: `export const owner = 'a';\n${block}\n`,
  [b]: `export const owner = 'b';\n${block}\n`,
});

// Builds a temp tree holding only the given files and the two configs, hands it to `inside`, removes it.
function inTree<T>(files: Record<string, string>, inside: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'jscpd-gate-'));

  try {
    for (const name of [PROD_CONFIG, TESTS_CONFIG]) {
      copyFileSync(resolve(root, name), join(dir, name));
    }

    for (const folder of SCOPE) {
      mkdirSync(join(dir, folder), { recursive: true });
    }

    for (const [file, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), content);
    }

    return inside(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function run(config: string, files: Record<string, string>) {
  return inTree(files, (dir) => {
    const result = spawnSync(JSCPD, ['--config', config], { cwd: dir, encoding: 'utf8' });
    const found = /Found (\d+)(?: exact)? clones/.exec(result.stdout);

    // A run that never counted clones (bad path, crash) is not a pass or a catch: clones is undefined.
    return { status: result.status, clones: found ? Number(found[1]) : undefined };
  });
}

const CAUGHT = { status: 1 };
const CLEAN = { status: 0, clones: 0 };

describe('the prod profile, run for real', () => {
  it('passes a tree with no duplicates', () => {
    expect(run(PROD_CONFIG, { 'server/src/a.ts': `export const a = 1;\n` })).toMatchObject(CLEAN);
  });

  it.each([
    ['a 12-line pair', pair('server/src/a.ts', 'server/src/b.ts', WIDE(12))],
    [
      'a 5-line pair (the lowest the prod profile catches)',
      pair('server/src/a.ts', 'server/src/b.ts', DENSE(5)),
    ],
    [
      'a 6-line pair (caught at 5 lines, not at 10)',
      pair('server/src/a.ts', 'server/src/b.ts', WIDE(6)),
    ],
    ['a pair in client .tsx', pair('client/src/a.tsx', 'client/src/b.tsx', WIDE(12))],
    ['a pair in shared', pair('shared/src/a.ts', 'shared/src/b.ts', WIDE(12))],
    ['a pair in scripts', pair('scripts/a.js', 'scripts/b.js', WIDE(12))],
    ['a pair in lint', pair('lint/a.js', 'lint/b.js', WIDE(12))],
    ['a pair across workspaces', pair('server/src/a.ts', 'client/src/b.ts', WIDE(12))],
  ])('fails on %s', (_name, files) => {
    const result = run(PROD_CONFIG, files);

    expect(result).toMatchObject(CAUGHT);
    expect(result.clones).toBeGreaterThan(0);
  });

  it.each([
    ['contest.ts', 'server/src/contest.ts', 'server/src/contest2.ts'],
    ['a latest/ folder', 'server/src/latest/a.ts', 'server/src/latest/b.ts'],
    ['a testing/ folder', 'server/src/testing/a.ts', 'server/src/testing/b.ts'],
    ['a .tests. file', 'server/src/a.tests.ts', 'server/src/b.tests.ts'],
    ['a .specs. file', 'server/src/a.specs.ts', 'server/src/b.specs.ts'],
    ['an e2e-helpers/ folder', 'server/src/e2e-helpers/a.ts', 'server/src/e2e-helpers/b.ts'],
  ])('still fails on a pair that only looks like a test: %s', (_name, a, b) => {
    expect(run(PROD_CONFIG, pair(a, b, WIDE(12)))).toMatchObject(CAUGHT);
  });

  it.each([
    ['a 4-line pair (under 5 lines)', pair('server/src/a.ts', 'server/src/b.ts', DENSE(4))],
    [
      'a 6-line pair of short lines (under 50 tokens)',
      pair('server/src/a.ts', 'server/src/b.ts', NARROW(6)),
    ],
    ['a *.test.ts pair', pair('server/src/a.test.ts', 'server/src/b.test.ts', WIDE(12))],
    ['a *.spec.tsx pair', pair('client/src/a.spec.tsx', 'client/src/b.spec.tsx', WIDE(12))],
    [
      'a pair in a test/ helper folder (the tests profile owns it)',
      pair('server/src/test/a.ts', 'server/src/test/b.ts', WIDE(12)),
    ],
    ['a pair in e2e/', pair('e2e/a.ts', 'e2e/b.ts', WIDE(12))],
    [
      'a pair in node_modules',
      pair('server/node_modules/p/a.ts', 'server/node_modules/p/b.ts', WIDE(12)),
    ],
    ['a pair in dist', pair('server/dist/a.ts', 'server/dist/b.ts', WIDE(12))],
    ['a pair in coverage', pair('client/coverage/a.ts', 'client/coverage/b.ts', WIDE(12))],
  ])('passes %s', (_name, files) => {
    expect(run(PROD_CONFIG, files)).toMatchObject(CLEAN);
  });
});

describe('the tests profile, run for real', () => {
  it('passes a tree with no duplicates', () => {
    expect(run(TESTS_CONFIG, { 'server/src/a.test.ts': `export const a = 1;\n` })).toMatchObject(
      CLEAN
    );
  });

  it.each([
    [
      'a 10-line test pair (the lowest the tests profile catches)',
      pair('server/src/a.test.ts', 'server/src/b.test.ts', DENSE(10)),
    ],
    ['a *.test.ts pair', pair('server/src/a.test.ts', 'server/src/b.test.ts', WIDE(12))],
    ['a *.spec.ts pair', pair('server/src/a.spec.ts', 'server/src/b.spec.ts', WIDE(12))],
    ['a *.test.tsx pair', pair('client/src/a.test.tsx', 'client/src/b.test.tsx', WIDE(12))],
    ['a *.spec.tsx pair', pair('client/src/a.spec.tsx', 'client/src/b.spec.tsx', WIDE(12))],
    ['an e2e *.spec.ts pair', pair('e2e/a.spec.ts', 'e2e/b.spec.ts', WIDE(12))],
    [
      'a test pair across workspaces',
      pair('server/src/a.test.ts', 'client/src/b.test.ts', WIDE(12)),
    ],
    ['a client test/ helper pair', pair('client/src/test/a.ts', 'client/src/test/b.ts', WIDE(12))],
    [
      'a client test/msw/ helper pair',
      pair('client/src/test/msw/a.ts', 'client/src/test/msw/b.ts', WIDE(12)),
    ],
    ['a server test/ helper pair', pair('server/src/test/a.ts', 'server/src/test/b.ts', WIDE(12))],
    ['a .test.js pair', pair('server/src/a.test.js', 'server/src/b.test.js', WIDE(12))],
    ['a .test.mjs pair', pair('server/src/a.test.mjs', 'server/src/b.test.mjs', WIDE(12))],
    ['a .spec.mts pair', pair('server/src/a.spec.mts', 'server/src/b.spec.mts', WIDE(12))],
  ])('fails on %s', (_name, files) => {
    const result = run(TESTS_CONFIG, files);

    expect(result).toMatchObject(CAUGHT);
    expect(result.clones).toBeGreaterThan(0);
  });

  it.each([
    [
      'a 6-line test pair (the tests profile starts at 10 lines)',
      pair('server/src/a.test.ts', 'server/src/b.test.ts', WIDE(6)),
    ],
    ['a 9-line test pair', pair('server/src/a.test.ts', 'server/src/b.test.ts', DENSE(9))],
    [
      'a 12-line pair of short lines (under 100 tokens)',
      pair('server/src/a.test.ts', 'server/src/b.test.ts', NARROW(12)),
    ],
    ['a production pair', pair('server/src/a.ts', 'server/src/b.ts', WIDE(12))],
    [
      'a test pair in node_modules',
      pair('server/node_modules/p/a.test.ts', 'server/node_modules/p/b.test.ts', WIDE(12)),
    ],
    ['a test pair in dist', pair('server/dist/a.test.ts', 'server/dist/b.test.ts', WIDE(12))],
    [
      'a test pair in coverage',
      pair('client/coverage/a.spec.ts', 'client/coverage/b.spec.ts', WIDE(12)),
    ],
  ])('passes %s', (_name, files) => {
    expect(run(TESTS_CONFIG, files)).toMatchObject(CLEAN);
  });
});

// Runs the whole `dup` script (guard, then both profiles) in a temp tree with jscpd on the PATH.
function runDup(files: Record<string, string>) {
  const manifest: { scripts: { dup: string } } = JSON.parse(
    readFileSync(resolve(root, 'package.json'), 'utf8')
  );
  const path = `${resolve(root, 'node_modules/.bin')}:${process.env.PATH ?? ''}`;

  return inTree(files, (dir) => ({
    status: spawnSync('sh', ['-c', manifest.scripts.dup], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PATH: path },
    }).status,
  }));
}

// Around a clone it would hide; the guard must fail whatever the file is, wherever it sits.
const fenced = (a: string, b: string): Record<string, string> => ({
  [a]: `export const owner = 'a';\n// ${MARKER}-start\n${WIDE(12)}\n// ${MARKER}-end\n`,
  [b]: `export const owner = 'b';\n// ${MARKER}-start\n${WIDE(12)}\n// ${MARKER}-end\n`,
});

describe('the ignore-marker guard in `npm run dup`', () => {
  it('passes a clean tree', () => {
    expect(runDup({ 'server/src/a.ts': 'export const a = 1;\n' })).toMatchObject({ status: 0 });
  });

  it('still fails a real clone that has no marker', () => {
    expect(runDup(pair('server/src/a.ts', 'server/src/b.ts', WIDE(12)))).not.toMatchObject({
      status: 0,
    });
  });

  it.each([
    ['server .ts', 'server/src/a.ts', 'server/src/b.ts'],
    ['client .tsx', 'client/src/a.tsx', 'client/src/b.tsx'],
    ['shared', 'shared/src/a.ts', 'shared/src/b.ts'],
    ['scripts .js', 'scripts/a.js', 'scripts/b.js'],
    ['lint .jsx', 'lint/a.jsx', 'lint/b.jsx'],
    ['e2e spec', 'e2e/a.spec.ts', 'e2e/b.spec.ts'],
    ['a *.test.ts', 'server/src/a.test.ts', 'server/src/b.test.ts'],
    ['a test/ helper', 'client/src/test/a.ts', 'client/src/test/b.ts'],
    ['.mjs', 'server/src/a.mjs', 'server/src/b.mjs'],
    ['.cjs', 'server/src/a.cjs', 'server/src/b.cjs'],
    ['.mts', 'server/src/a.mts', 'server/src/b.mts'],
    ['.cts', 'server/src/a.cts', 'server/src/b.cts'],
  ])('fails a planted marker around a clone in %s', (_name, a, b) => {
    expect(runDup(fenced(a, b))).not.toMatchObject({ status: 0 });
  });

  it('fails a lone marker with no clone at all', () => {
    expect(
      runDup({ 'server/src/a.ts': `// ${MARKER}-next-line\nexport const a = 1;\n` })
    ).not.toMatchObject({ status: 0 });
  });

  it.each(['node_modules/p', 'dist', 'coverage'])(
    'ignores a marker inside generated output (%s)',
    (folder) => {
      expect(
        runDup({ [`server/${folder}/a.ts`]: `// ${MARKER}-start\nexport const a = 1;\n` })
      ).toMatchObject({ status: 0 });
    }
  );
});
