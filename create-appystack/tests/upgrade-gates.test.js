import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  cpSync,
  renameSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { classifyFile } from '../bin/lib/classify.js';
import { mergeGatePackage, GATE_SCRIPTS, GATE_DEV_DEPS } from '../bin/lib/gate-package.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const TEMPLATE = join(REPO, 'template');
const UPGRADE_BIN = join(HERE, '../bin/upgrade.js');

const writeJson = (dir, rel, obj) => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), JSON.stringify(obj, null, 2) + '\n');
};
const readJson = (dir, rel) => JSON.parse(readFileSync(join(dir, rel), 'utf-8'));
// Remove a scratch dir only if it is a non-empty absolute path under the OS temp dir.
const removeScratch = (dir) => {
  if (!dir || !resolve(dir).startsWith(resolve(tmpdir()) + '/')) throw new Error(`refusing to remove ${dir}`);
  rmSync(dir, { recursive: true, force: true });
};

describe('gate files classify auto', () => {
  it('every file in template/lint/ is auto (drift guard: a new gate file must be listed)', () => {
    const files = readdirSync(join(TEMPLATE, 'lint')).map((f) => `lint/${f}`);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(classifyFile(f), f).toBe('auto');
  });

  it('classifies the Oxlint config and the HTTP_STATUS helper as auto', () => {
    expect(classifyFile('.oxlintrc.json')).toBe('auto');
    expect(classifyFile('server/src/helpers/httpStatus.ts')).toBe('auto');
  });

  it('keeps package.json never', () => {
    expect(classifyFile('package.json')).toBe('never');
  });
});

describe('mergeGatePackage', () => {
  let root, consumer, template;
  const templatePkg = {
    scripts: {
      lint: 'oxlint && eslint .',
      'lint:fix': 'oxlint --fix && eslint . --fix',
      build: 'tsc',
    },
    devDependencies: {
      '@stylistic/eslint-plugin': '^5.10.0',
      'eslint-plugin-oxlint': '1.90.0',
      oxlint: '1.90.0',
      vitest: '^4',
    },
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gate-merge-'));
    consumer = join(root, 'consumer');
    template = join(root, 'template');
    mkdirSync(consumer);
    mkdirSync(template);
    writeJson(template, 'package.json', templatePkg);
  });
  afterEach(() => removeScratch(root));

  it('adds absent gate entries and replaces the known prior template scripts', () => {
    writeJson(consumer, 'package.json', {
      name: 'mine',
      scripts: {
        lint: 'eslint .',
        'lint:fix': 'eslint . --fix',
        build: 'custom',
      },
      devDependencies: { zod: '^3' },
    });
    const changed = mergeGatePackage(consumer, template);
    const pkg = readJson(consumer, 'package.json');
    expect(changed).toHaveLength(2 + GATE_DEV_DEPS.length);
    for (const s of GATE_SCRIPTS) expect(pkg.scripts[s]).toBe(templatePkg.scripts[s]);
    for (const d of GATE_DEV_DEPS) expect(pkg.devDependencies[d]).toBe(templatePkg.devDependencies[d]);
    expect(pkg.scripts.build).toBe('custom'); // not gate-owned
    expect(pkg.devDependencies).not.toHaveProperty('vitest'); // not gate-owned
    expect(pkg.devDependencies.zod).toBe('^3');
    expect(pkg.name).toBe('mine');
    expect(existsSync(join(consumer, 'UPGRADE_TODO.md'))).toBe(false);
  });

  it('leaves a customized script or pinned dependency and writes an UPGRADE_TODO row', () => {
    writeJson(consumer, 'package.json', {
      scripts: { lint: 'my-lint', 'lint:fix': 'eslint . --fix' },
      devDependencies: { oxlint: '1.50.0' },
    });
    mergeGatePackage(consumer, template);
    const pkg = readJson(consumer, 'package.json');
    expect(pkg.scripts.lint).toBe('my-lint');
    expect(pkg.devDependencies.oxlint).toBe('1.50.0');
    const todo = readFileSync(join(consumer, 'UPGRADE_TODO.md'), 'utf-8');
    expect(todo).toContain('scripts.lint');
    expect(todo).toContain('devDependencies.oxlint');
    expect(todo).not.toContain('scripts.lint:fix');
  });

  it('does not write when nothing changes', () => {
    writeJson(consumer, 'package.json', templatePkg);
    const before = readFileSync(join(consumer, 'package.json'), 'utf-8');
    expect(mergeGatePackage(consumer, template)).toEqual([]);
    expect(readFileSync(join(consumer, 'package.json'), 'utf-8')).toBe(before);
    expect(existsSync(join(consumer, 'UPGRADE_TODO.md'))).toBe(false);
  });
});

// The proof: a real 0.4.18 template, upgraded by this branch, installs and runs both linters.
// Not established: that this equals real CLI scaffold output, or cold-cache install time in CI.
const run = (cmd, args, cwd, timeout = 150_000) =>
  spawnSync(cmd, args, {
    cwd,
    encoding: 'utf-8',
    timeout,
    env: { ...process.env, CI: 'true' },
  });

describe('appystack-upgrade carries the gates to a 0.4.18 app', () => {
  let root, packDir, app;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gate-proof-'));
    packDir = join(root, 'pack');
    app = join(root, 'app');
    mkdirSync(packDir);
  });
  afterEach(() => removeScratch(root));

  it('installs and runs ESLint and Oxlint without a load error', { timeout: 180_000 }, (ctx) => {
    const pack = run(
      'npm',
      ['pack', 'create-appystack@0.4.18', '--pack-destination', packDir, '--silent'],
      root,
    );
    if (pack.status !== 0) {
      if (process.env.CI) throw new Error(`npm pack create-appystack@0.4.18 failed: ${pack.stderr}`);
      console.warn('SKIPPED (offline, CI unset): npm pack failed');
      return ctx.skip();
    }
    const tarball = join(
      packDir,
      readdirSync(packDir).find((f) => f.endsWith('.tgz')),
    );
    expect(run('tar', ['-xzf', tarball, '-C', packDir], root).status).toBe(0);
    cpSync(join(packDir, 'package', 'template'), app, { recursive: true });
    renameSync(join(app, 'gitignore'), join(app, '.gitignore'));
    for (const args of [
      ['init', '-q'],
      ['add', '-A'],
      ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'scaffold'],
    ]) {
      expect(run('git', args, app).status, args.join(' ')).toBe(0);
    }
    const sha = run('git', ['rev-parse', 'HEAD'], app).stdout.trim();
    writeJson(app, 'appystack.json', {
      version: '0.4.18',
      scaffoldCommit: sha,
    });

    const up = run('node', [UPGRADE_BIN, '--template-path', TEMPLATE, '--yes'], app);
    expect(up.status, up.stdout + up.stderr).toBe(0);
    expect(readJson(app, 'package.json').scripts.lint).toContain('oxlint');

    // A plain `npm install` on the stale 0.4.18 lockfile fails ERESOLVE (oxlint's optional vite-plus peer pulls vitest 5);
    // once --legacy-peer-deps has regenerated the lockfile, plain installs work. upgrade.js tells the user this.
    const install = run(
      'npm',
      ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--legacy-peer-deps'],
      app,
      170_000,
    );
    expect(install.status, install.stderr).toBe(0);

    // Run each linter on its own: the lint script stops at Oxlint's first failure, which would hide a broken ESLint config.
    const loadErrors =
      /Cannot find (module|package)|ERR_MODULE_NOT_FOUND|ConfigError|Invalid config|not found/i;
    const report = {};
    for (const [name, args, count] of [
      // --format default pins the output: under CI=true oxlint would switch to GitHub annotations
      [
        'oxlint',
        ['oxlint', '--deny-warnings', '--format', 'default'],
        /Found (\d+) warnings? and (\d+) errors?/,
      ],
      ['eslint', ['eslint', '.'], /(\d+) problems?/],
    ]) {
      const r = run('npx', ['--no-install', ...args], app, 170_000);
      const out = r.stdout + r.stderr;
      expect(out, `${name}: ${out.slice(-1500)}`).not.toMatch(loadErrors);
      const m = out.match(count);
      // exit 0, or findings only: a linter that failed to load exits non-zero with no count
      expect(r.status === 0 || m !== null, `${name}: ${out.slice(-1500)}`).toBe(true);
      report[name] = r.status === 0 ? 0 : m.slice(1).reduce((sum, n) => sum + Number(n), 0);
    }
    console.log(`0.4.18 app after upgrade: ${JSON.stringify(report)}`);
  });
});
