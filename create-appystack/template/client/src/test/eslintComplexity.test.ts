// @vitest-environment node
// eslint.config.js builds file URLs, which jsdom's URL cannot do.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ESLint } from 'eslint';
import { afterAll, describe, expect, it } from 'vitest';

// vitest runs with the client workspace as cwd; the configs sit one level up, at the template root.
const root = resolve(process.cwd(), '..');
const eslint = new ESLint({ cwd: root });
const ERROR_SEVERITY = 2;
const COGNITIVE = 'sonarjs/cognitive-complexity';
const EXPRESSION = 'sonarjs/expression-complexity';

async function count(ruleId: string, source: string, file = 'server/src/probe.ts') {
  const [result] = await eslint.lintText(source, { filePath: resolve(root, file) });

  // severity 2 is 'error': a gate that only warns does not fail the build.
  return (result?.messages ?? []).filter(
    (message) => message.ruleId === ruleId && message.severity === ERROR_SEVERITY
  ).length;
}

// n sequential ifs: cognitive n, cyclomatic n + 1.
function ifs(n: number) {
  return `export function f(a: number) {\n${'  if (a) {\n    a += 1;\n  }\n'.repeat(n)}  return a;\n}\n`;
}

// n operands joined by &&: n - 1 operators.
function chain(n: number) {
  const names = Array.from({ length: n }, (_, i) => `v${i}`);

  return `export const f = (${names.map((v) => `${v}: boolean`).join(', ')}) => ${names.join(' && ')};\n`;
}

describe('G06 cognitive and expression gates, run through the real eslint.config.js', () => {
  it('rejects cognitive 9 and allows 8', async () => {
    expect(await count(COGNITIVE, ifs(9))).toBe(1);
    expect(await count(COGNITIVE, ifs(8))).toBe(0);
  });

  it('rejects 4 expression operators and allows 3', async () => {
    expect(await count(EXPRESSION, chain(5))).toBe(1);
    expect(await count(EXPRESSION, chain(4))).toBe(0);
  });

  it('counts operators inside JSX attributes', async () => {
    const jsx = (n: number) =>
      `export const C = (p: boolean) => <div className={${chain(n).split('=> ')[1].replace(/v\d+/g, 'p').replace(';\n', '')}} />;\n`;

    expect(await count(EXPRESSION, jsx(5), 'client/src/probe.tsx')).toBe(1);
    expect(await count(EXPRESSION, jsx(4), 'client/src/probe.tsx')).toBe(0);
  });

  it.each([
    'client/src/probe.ts',
    'client/src/probe.tsx',
    'server/src/probe.ts',
    'shared/src/probe.ts',
  ])('checks %s', async (file) => {
    expect(await count(COGNITIVE, ifs(9), file)).toBe(1);
  });

  it.each(['probe.js', 'probe.mjs', 'probe.cjs'])('also checks %s', async (name) => {
    expect(await count(COGNITIVE, ifs(9), `server/src/${name}`)).toBe(1);
  });

  it('exempts test files by kind, under any folder', async () => {
    expect(await count(COGNITIVE, ifs(9), 'server/src/probe.test.ts')).toBe(0);
    expect(await count(EXPRESSION, chain(5), 'client/src/probe.test.tsx')).toBe(0);
    expect(await count(COGNITIVE, ifs(9), 'client/src/test/probe.ts')).toBe(0);
  });

  // The whole block is pinned, so a widened ignore on a directory no probe names cannot slip through.
  // Changing the block now takes two edits: eslint.config.js and this expected value.
  it('is exactly the reviewed quality/complexity block', async () => {
    const { default: config } = await import(pathToFileURL(resolve(root, 'eslint.config.js')).href);
    const block = config.find((entry: { name?: string }) => entry.name === 'quality/complexity');
    const { plugins, ...rest } = block ?? {};

    expect(rest).toEqual({
      name: 'quality/complexity',
      files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
      ignores: ['**/*.test.*', '**/test/**'],
      rules: {
        [COGNITIVE]: ['error', 8],
        [EXPRESSION]: ['error', { max: 3 }],
      },
    });
    expect(Object.keys(plugins ?? {})).toEqual(['sonarjs']);
  });

  // The block's `files` and `ignores` are pinned from both sides: these paths must be linted ...
  it.each([
    'server/src/latest/probe.ts',
    'server/src/contest.ts',
    'server/src/protest/probe.ts',
    'server/src/probe.spec.ts',
    'client/src/probe.spec.tsx',
    'client/src/demo/probe.tsx',
    'client/src/probe.jsx',
    'scripts/probe.ts',
    'lint/probe.js',
    'probe.config.ts',
  ])('does not exempt %s (only *.test.* and /test/ are out of scope)', async (file) => {
    // Plain JavaScript source so .js and .jsx parse whatever parser the config gives them.
    expect(await count(COGNITIVE, ifs(9).replace(': number', ''), file)).toBe(1);
  });

  it('turns on exactly the two reviewed sonarjs rules, and leaves cyclomatic to Oxlint', async () => {
    const config = await eslint.calculateConfigForFile(resolve(root, 'server/src/probe.ts'));
    const on = Object.entries(config.rules ?? {}).filter(([, value]) => {
      const level = Array.isArray(value) ? value[0] : value;

      return level !== 0 && level !== 'off';
    });
    const sonar = on.filter(([name]) => name.startsWith('sonarjs/'));

    expect(sonar).toEqual([
      [COGNITIVE, [ERROR_SEVERITY, 8]],
      [EXPRESSION, [ERROR_SEVERITY, { max: 3 }]],
    ]);
    // One owner per metric: ESLint's own copy is off (eslint-plugin-oxlint), SonarJS's copy is never on.
    expect(on.map(([name]) => name)).not.toContain('complexity');
  });
});

describe('G06 cyclomatic gate: Oxlint `complexity`, run on the real .oxlintrc.json', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'g06-oxlint-'));
  const oxlint = resolve(root, 'node_modules/.bin/oxlint');

  writeFileSync(resolve(dir, '.oxlintrc.json'), readFileSync(resolve(root, '.oxlintrc.json')));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  // Lint the probe in a temp tree that carries the real config, so path overrides resolve from it.
  function flagged(source: string, file: string) {
    const path = resolve(dir, file);

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);

    const run = spawnSync(oxlint, ['--format', 'default', '--deny-warnings', file], {
      cwd: dir,
      encoding: 'utf8',
    });

    return {
      status: run.status,
      hits: run.stdout.split('\n').filter((l) => l.includes('eslint(complexity)')).length,
    };
  }

  it('rejects cyclomatic 7 (fails the run) and allows 6', () => {
    expect(flagged(ifs(6), 'server/src/seven.ts')).toEqual({ status: 1, hits: 1 });
    expect(flagged(ifs(5), 'server/src/six.ts')).toEqual({ status: 0, hits: 0 });
  });

  it.each(['client/src/p.tsx', 'server/src/p.ts', 'shared/src/p.ts'])('checks %s', (file) => {
    expect(flagged(ifs(6), file).hits).toBe(1);
  });

  it('exempts test files by kind, under any folder', () => {
    expect(flagged(ifs(6), 'server/src/p.test.ts').hits).toBe(0);
    expect(flagged(ifs(6), 'client/src/test/p.ts').hits).toBe(0);
  });
});
