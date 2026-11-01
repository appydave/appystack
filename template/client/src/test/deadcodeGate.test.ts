// @vitest-environment node
// Runs the real `deadcode` script (knip, dependency-cruiser) in temp trees: needs child_process and fs.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
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
// The workspaces are cruised on their own with their tsconfig; this root cruise takes everything else
// (scripts/, e2e/, root files) and skips the workspaces and build output.
const ROOT_SKIP =
  '^(client|server|shared)/|(^|/)(node_modules|dist|build|coverage|playwright-report|test-results)/';
const ROOT_CRUISE = `depcruise -c .dependency-cruiser.cjs -x '${ROOT_SKIP}' .`;
const script = (flag = CRUISE_FLAG, rootCruise = ROOT_CRUISE): string =>
  `${guard} ${include} ${exclude} . ; [ $? -eq 1 ] && knip && ${[...WORKSPACES.map((w) => cruise(w, flag)), rootCruise].join(' && ')}`;

// Knip reads a config from its own list of names (read from the installed package, so a new Knip
// cannot add a name this pin misses), or a "knip" key in package.json. One with ignore: ['**'] hides everything.
const knipOwnNames = (): string[] => {
  const constants = readFileSync(resolve(root, 'node_modules/knip/dist/constants.js'), 'utf8');
  const list = /KNIP_CONFIG_LOCATIONS = \[([^\]]*)\]/.exec(constants)?.[1] ?? '';

  return [...list.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '');
};

const KNIP_NAMES = new Set([
  ...knipOwnNames(),
  ...['json', 'jsonc', 'ts', 'js', 'mjs', 'cjs', 'mts', 'cts'].flatMap((ext) => [
    `knip.${ext}`,
    `.knip.${ext}`,
    `.config/knip.${ext}`,
  ]),
]);
const knipConfigs = (dir: string): string[] => {
  const found = ['.', ...WORKSPACES].flatMap((where) => {
    const named = [...KNIP_NAMES].filter((name) => existsSync(join(dir, where, name)));
    const pkg = join(dir, where, 'package.json');
    const keyed = existsSync(pkg) && 'knip' in JSON.parse(readFileSync(pkg, 'utf8'));

    return [...named, ...(keyed ? ['package.json'] : [])].map((file) => join(where, file));
  });

  return found.map((file) => file.replace(/^\.\//, ''));
};

describe('the deadcode gate configuration', () => {
  it('`npm run deadcode` is exactly: tag guard, knip, then dependency-cruiser in each workspace with --ts-config, then over the root (scripts, e2e, root files)', () => {
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

  it('has no Knip config anywhere (the gate runs on Knip defaults only)', () => {
    expect(
      knipConfigs(root),
      'Delete the Knip config. A config can ignore files and hide findings; the gate takes no config.'
    ).toEqual([]);
  });

  it('the Knip config check sees every name Knip itself reads', () => {
    expect(knipOwnNames()).toEqual(expect.arrayContaining(['knip.json', 'knip.config.ts']));

    for (const name of knipOwnNames()) {
      const dir = mkdtempSync(join(tmpdir(), 'knip-own-'));

      try {
        writeFileSync(join(dir, name), '{}');

        expect(knipConfigs(dir), name).toEqual([name]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it.each([
    ['knip.json', '.', 'knip.json'],
    ['knip.jsonc', '.', 'knip.jsonc'],
    ['knip.ts', '.', 'knip.ts'],
    ['knip.config.ts', '.', 'knip.config.ts'],
    ['a workspace knip.config.js', 'shared', 'knip.config.js'],
    ['.knip.json', '.', '.knip.json'],
    ['.config/knip.mjs', '.', '.config/knip.mjs'],
    ['a workspace knip.json', 'server', 'knip.json'],
    ['a workspace .config/knip.ts', 'client', '.config/knip.ts'],
  ])('the Knip config check sees %s', (_label, where, file) => {
    const dir = mkdtempSync(join(tmpdir(), 'knip-config-'));

    try {
      mkdirSync(dirname(join(dir, where, file)), { recursive: true });
      writeFileSync(join(dir, where, file), '{}');

      expect(knipConfigs(dir)).toEqual([join(where === '.' ? '' : where, file)]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each(['.', 'client'])(
    'the Knip config check sees a "knip" key in %s/package.json',
    (where) => {
      const dir = mkdtempSync(join(tmpdir(), 'knip-key-'));

      try {
        mkdirSync(join(dir, where), { recursive: true });
        writeFileSync(
          join(dir, where, 'package.json'),
          JSON.stringify({ knip: { ignore: ['**'] } })
        );

        expect(knipConfigs(dir)).toEqual([join(where === '.' ? '' : where, 'package.json')]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );

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

// scripts/ and e2e/ sit outside every workspace; both are package scripts here so Knip sees every file as used.
const rootCycle = (dir: 'scripts' | 'e2e'): Record<string, string> => ({
  'package.json': JSON.stringify({
    name: 't',
    private: true,
    workspaces: WORKSPACES,
    scripts: { deadcode: script(), tool: 'tsx scripts/a.ts', e2e: 'tsx e2e/a.ts' },
    devDependencies: { knip: '*', 'dependency-cruiser': '*', tsx: '*' },
  }),
  'scripts/a.ts': `import { b } from './b.js';\nexport const a = b;\n`,
  'scripts/b.ts': `export const b = 1;\n`,
  'e2e/a.ts': `import { b } from './b.js';\nexport const a = b;\n`,
  'e2e/b.ts': `export const b = 1;\n`,
  [`${dir}/b.ts`]: `import { a } from './a.js';\nexport const b = a;\n`,
});

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

  it.each(['scripts', 'e2e'] as const)(
    'fails on an import cycle in %s/, outside every workspace',
    (dir) => {
      expect(runScript(sources(rootCycle(dir)))).toBe(1);
    }
  );

  it.each(['scripts', 'e2e'] as const)(
    'would miss that %s/ cycle without the root cruise (the root cruise is what sees it)',
    (dir) => {
      expect(runScript(sources(rootCycle(dir)), script(CRUISE_FLAG, 'true'))).toBe(0);
    }
  );

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
