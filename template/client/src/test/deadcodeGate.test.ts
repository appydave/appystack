// @vitest-environment node
// Runs the real `deadcode` script (knip, dependency-cruiser) in temp trees: needs child_process and fs.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// vitest runs with the client workspace as cwd; package.json and the configs sit one level up.
const root = resolve(process.cwd(), '..');
const read = (file: string): string => readFileSync(resolve(root, file), 'utf8');
const manifest: { scripts: { deadcode: string }; devDependencies: Record<string, string> } =
  JSON.parse(read('package.json'));
const CONFIG = '.dependency-cruiser.cjs';
const WORKSPACES = ['client', 'server', 'shared'];
const TYPES = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts'];
// Built from parts so this file does not contain the tags it forbids (the guard scans it too).
const TAGS = ['public', 'internal', 'beta', 'alias'];
const tag = (name: string): string => ['@', name].join('');
// The guard may skip only what Knip itself ignores (its gitignored folders), or a tag there would hide an export.
const SKIP_DIRS = ['node_modules', 'dist', 'coverage'];
const CRUISE_FLAG = '--ts-config tsconfig.json';
const cruise = (workspace: string, flag = CRUISE_FLAG): string =>
  `(cd ${workspace} && depcruise -c ../.dependency-cruiser.cjs ${flag} src)`;
const include = TYPES.map((type) => `--include='*.${type}'`).join(' ');
const exclude = SKIP_DIRS.map((dir) => `--exclude-dir=${dir}`).join(' ');
const guard = ['gre', 'p'].join('') + ` -rqE '@(${TAGS.join('|')})'`;
const script = (flag = CRUISE_FLAG): string =>
  `${guard} ${include} ${exclude} . ; [ $? -eq 1 ] && knip && ${WORKSPACES.map((w) => cruise(w, flag)).join(' && ')}`;

describe('the deadcode gate configuration', () => {
  it('`npm run deadcode` is exactly: tag guard, knip, then dependency-cruiser in each workspace with --ts-config', () => {
    expect(
      manifest.scripts.deadcode,
      'The deadcode script changed. Restore it, or update script() in this test in the same PR.'
    ).toBe(script());
  });

  it('the guard skips only folders the root gitignore lists (the ones Knip ignores)', () => {
    const ignored = read('gitignore').split('\n');

    for (const dir of SKIP_DIRS) {
      expect(ignored, dir).toContain(dir);
    }
  });

  it('pins knip and dependency-cruiser to exact versions', () => {
    for (const name of ['knip', 'dependency-cruiser']) {
      expect(manifest.devDependencies[name], name).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('the cruise config is exactly one rule, no-circular, as an error', () => {
    const config: unknown = createRequire(import.meta.url)(resolve(root, CONFIG));

    expect(config).toEqual({
      forbidden: [{ name: 'no-circular', severity: 'error', from: {}, to: { circular: true } }],
      options: { doNotFollow: { path: 'node_modules' }, tsPreCompilationDeps: true },
    });
  });

  it('CI runs `npm run deadcode` as a "Dead code and import cycles" step after Duplicates', () => {
    const ci = read('.github/workflows/ci.yml');
    const dup = ci.indexOf('- name: Duplicates\n        run: npm run dup\n');
    const dead = ci.indexOf('- name: Dead code and import cycles\n        run: npm run deadcode\n');

    expect(dup, 'ci.yml lost its Duplicates step').toBeGreaterThan(-1);
    expect(dead, 'Add the deadcode step right after Duplicates in ci.yml.').toBeGreaterThan(dup);
  });
});

const sources = (extra: Record<string, string> = {}): Record<string, string> => ({
  'package.json': JSON.stringify({
    name: 't',
    private: true,
    workspaces: WORKSPACES,
    scripts: { deadcode: script() }, // knip finds the depcruise binary from the script
    devDependencies: { knip: '*', 'dependency-cruiser': '*' },
  }),
  ...Object.fromEntries(WORKSPACES.map((w) => [`${w}/package.json`, JSON.stringify({ name: w })])),
  ...Object.fromEntries(
    WORKSPACES.map((w) => [
      `${w}/tsconfig.json`,
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@lib/*': ['src/lib/*'] },
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
        },
        include: ['src/**/*'],
      }),
    ])
  ),
  'server/src/index.ts': `import { used } from '@lib/used.js';\nexport const main = used;\n`,
  'server/src/lib/used.ts': `export const used = 1;\n`,
  'client/src/index.ts': `export const client = 1;\n`,
  'shared/src/index.ts': `export const shared = 1;\n`,
  ...extra,
});

// Writes the tree, links the real binaries, runs the script text in it, removes it. Status only.
function runScript(files: Record<string, string>, text = script()): number | null {
  const dir = mkdtempSync(join(tmpdir(), 'deadcode-gate-'));

  try {
    for (const [file, content] of Object.entries({
      ...files,
      '.gitignore': 'node_modules\n',
      [CONFIG]: read(CONFIG),
    })) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), content);
    }

    symlinkSync(resolve(root, 'node_modules'), join(dir, 'node_modules'));

    const bin = resolve(root, 'node_modules/.bin');
    const env = { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` };

    return spawnSync('sh', ['-c', text], { cwd: dir, env, encoding: 'utf8' }).status;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const cycle = {
  'server/src/lib/a.ts': `import { b } from '@lib/b.js';\nexport const a = (): number => b() + 1;\n`,
  'server/src/lib/b.ts': `import { a } from '@lib/a.js';\nexport const b = (): number => a() + 1;\n`,
  'server/src/index.ts': `import { used } from '@lib/used.js';
import { a } from '@lib/a.js';
export const main = [used, a];
`,
};

describe('the deadcode script, run for real', () => {
  it('passes a clean tree', () => {
    expect(runScript(sources())).toBe(0);
  });

  it('fails on an unused export in a used file', () => {
    expect(
      runScript(
        sources({ 'server/src/lib/used.ts': `export const used = 1;\nexport const dead = 2;\n` })
      )
    ).toBe(1);
  });

  it('fails on a two-file import cycle written with an alias', () => {
    expect(runScript(sources(cycle))).toBe(1);
  });

  it('would miss that alias cycle without --ts-config (the flag is what makes the gate see it)', () => {
    expect(runScript(sources(cycle), script(''))).toBe(0);
  });

  it.each(TAGS)('refuses the %s tag, which would hide an unused export from knip', (name) => {
    const tagged = `/** ${tag(name)} */\nexport const used = 1;\n`;

    expect(runScript(sources({ 'server/src/lib/used.ts': tagged }))).toBe(1);
  });

  it('does not read a tag inside node_modules', () => {
    expect(runScript(sources({ 'client/node_modules/x/y.ts': `/** ${tag('public')} */\n` }))).toBe(
      0
    );
  });
});
