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
import { appendServerAliasTodo } from '../bin/lib/alias-todo.js';
import { appendAppErrorTodo } from '../bin/lib/reexport-todo.js';

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

  it('every .jscpd*.json at the template root is auto (a new profile must be listed)', () => {
    const files = readdirSync(TEMPLATE).filter((f) => f.startsWith('.jscpd'));
    expect(files).toEqual(['.jscpd.json', '.jscpd.tests.json']);
    for (const f of files) expect(classifyFile(f), f).toBe('auto');
  });

  it('classifies the Oxlint config and the HTTP_STATUS helper as auto', () => {
    expect(classifyFile('.oxlintrc.json')).toBe('auto');
    expect(classifyFile('server/src/helpers/httpStatus.ts')).toBe('auto');
    expect(classifyFile('.dependency-cruiser.cjs')).toBe('auto');
  });

  it('keeps package.json never', () => {
    expect(classifyFile('package.json')).toBe('never');
  });
});

describe('the gate lists match the real template package.json', () => {
  const real = JSON.parse(readFileSync(join(TEMPLATE, 'package.json'), 'utf-8'));

  it('every gate script and gate dev dependency exists in the template', () => {
    for (const s of GATE_SCRIPTS) expect(real.scripts, s).toHaveProperty(s);
    for (const d of GATE_DEV_DEPS) expect(real.devDependencies, d).toHaveProperty(d);
  });

  it('lists the dead-code gate: the deadcode script, knip, dependency-cruiser and the root tsx', () => {
    expect(GATE_SCRIPTS).toContain('deadcode');
    for (const d of ['knip', 'dependency-cruiser', 'tsx']) expect(GATE_DEV_DEPS).toContain(d);
  });

  it('lists the duplicates gate: the dup script and the jscpd dependency', () => {
    expect(GATE_SCRIPTS).toContain('dup');
    expect(GATE_DEV_DEPS).toContain('jscpd');
  });
});

describe('mergeGatePackage', () => {
  let root, consumer, template;
  const templatePkg = {
    scripts: {
      lint: 'oxlint && eslint .',
      'lint:fix': 'oxlint --fix && eslint . --fix',
      dup: 'jscpd --config .jscpd.json',
      deadcode: 'knip',
      build: 'tsc',
    },
    devDependencies: {
      '@stylistic/eslint-plugin': '^5.10.0',
      'dependency-cruiser': '18.7.0',
      'eslint-plugin-oxlint': '1.90.0',
      'eslint-plugin-sonarjs': '4.2.2',
      jscpd: '5.4.2',
      knip: '6.44.1',
      oxlint: '1.90.0',
      tsx: '^4.23.15',
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
    expect(changed).toHaveLength(GATE_SCRIPTS.length + GATE_DEV_DEPS.length);
    for (const s of GATE_SCRIPTS) expect(pkg.scripts[s]).toBe(templatePkg.scripts[s]);
    for (const d of GATE_DEV_DEPS) expect(pkg.devDependencies[d]).toBe(templatePkg.devDependencies[d]);
    expect(pkg.scripts.build).toBe('custom'); // not gate-owned
    expect(pkg.devDependencies).not.toHaveProperty('vitest'); // not gate-owned
    expect(pkg.devDependencies.zod).toBe('^3');
    expect(pkg.name).toBe('mine');
    // the one generic row: the new gate will report the app's own dead code
    expect(readFileSync(join(consumer, 'UPGRADE_TODO.md'), 'utf-8')).toContain('npm run deadcode');
  });

  it('leaves a customized script or pinned dependency and writes an UPGRADE_TODO row', () => {
    writeJson(consumer, 'package.json', {
      scripts: { lint: 'my-lint', 'lint:fix': 'eslint . --fix', dup: 'my-dup' },
      devDependencies: { oxlint: '1.50.0' },
    });
    mergeGatePackage(consumer, template);
    const pkg = readJson(consumer, 'package.json');
    expect(pkg.scripts.lint).toBe('my-lint');
    expect(pkg.devDependencies.oxlint).toBe('1.50.0');
    const todo = readFileSync(join(consumer, 'UPGRADE_TODO.md'), 'utf-8');
    expect(pkg.scripts.dup).toBe('my-dup');
    expect(todo).toContain('scripts.lint');
    expect(todo).toContain('scripts.dup');
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

// G10: the template's server code imports through @config/@helpers/@test; an upgraded app keeps its old
// (never-tier) tsconfig and vitest config, so the tool writes the exact lines to add.
describe('appendServerAliasTodo', () => {
  let consumer;
  beforeEach(() => {
    consumer = mkdtempSync(join(tmpdir(), 'alias-todo-'));
  });
  afterEach(() => removeScratch(consumer));

  const oldTsconfig = '{ "compilerOptions": { "paths": { "@config/*": ["src/config/*"] } } }';
  const oldVitest = "import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: {} });\n";
  const write = (rel, text) => {
    mkdirSync(dirname(join(consumer, rel)), { recursive: true });
    writeFileSync(join(consumer, rel), text);
  };

  it('writes the exact missing paths and aliases for a 0.4.x server, and the ../ rewrite row', () => {
    write('server/tsconfig.json', oldTsconfig);
    write('server/vitest.config.ts', oldVitest);
    expect(appendServerAliasTodo(consumer)).toBe(true);
    const todo = readFileSync(join(consumer, 'UPGRADE_TODO.md'), 'utf-8');
    expect(todo).toContain('`"@helpers/*": ["src/helpers/*"]`, `"@test/*": ["src/test/*"]`');
    expect(todo).not.toContain('"@config/*"');
    expect(todo).toContain("`'@config': path.resolve(__dirname, 'src/config')`");
    expect(todo).toContain("`'@helpers': path.resolve(__dirname, 'src/helpers')`");
    expect(todo).toContain("`'@test': path.resolve(__dirname, 'src/test')`");
    expect(todo).toContain('Rewrite each to an alias');
  });

  it('writes nothing for an app that already has them, and nothing without a server', () => {
    expect(appendServerAliasTodo(consumer)).toBe(false);
    write(
      'server/tsconfig.json',
      '{ "paths": { "@config/*": [], "@helpers/*": [], "@test/*": [] } }',
    );
    write('server/vitest.config.ts', "alias: { '@config': 1, '@helpers': 2, '@test': 3 }");
    expect(appendServerAliasTodo(consumer)).toBe(false);
    expect(existsSync(join(consumer, 'UPGRADE_TODO.md'))).toBe(false);
  });

  it('only asks for what is missing in each file', () => {
    write('server/vitest.config.ts', oldVitest); // no tsconfig at all: no paths row
    appendServerAliasTodo(consumer);
    const todo = readFileSync(join(consumer, 'UPGRADE_TODO.md'), 'utf-8');
    expect(todo).not.toContain('server/tsconfig.json');
    expect(todo).toContain('server/vitest.config.ts');
    removeScratch(consumer);
    consumer = mkdtempSync(join(tmpdir(), 'alias-todo-'));
    write('server/tsconfig.json', oldTsconfig); // no vitest config at all: no alias row
    appendServerAliasTodo(consumer);
    expect(readFileSync(join(consumer, 'UPGRADE_TODO.md'), 'utf-8')).not.toContain('vitest.config');
  });

  it('reads the vitest aliases by exact name, in either quote style', () => {
    write('server/tsconfig.json', '{ "paths": { "@config/*": [], "@helpers/*": [], "@testing/*": [] } }');
    write('server/vitest.config.ts', 'import { env } from "@config/env.js";\nalias: { "@helpers": 2, "@test": 3 }');
    expect(appendServerAliasTodo(consumer)).toBe(true); // an import of @config/ is not the alias
    const todo = readFileSync(join(consumer, 'UPGRADE_TODO.md'), 'utf-8');
    expect(todo).toContain('Add to compilerOptions.paths: `"@test/*": ["src/test/*"]` |'); // @testing/* is not @test/*
    expect(todo).toContain("`'@config': path.resolve");
    expect(todo).not.toContain("`'@helpers': path.resolve");
    expect(todo).not.toContain("`'@test': path.resolve");
  });

  it('does not repeat a row when run twice', () => {
    write('server/tsconfig.json', oldTsconfig);
    write('server/vitest.config.ts', oldVitest);
    appendServerAliasTodo(consumer);
    const once = readFileSync(join(consumer, 'UPGRADE_TODO.md'), 'utf-8');
    appendServerAliasTodo(consumer);
    expect(readFileSync(join(consumer, 'UPGRADE_TODO.md'), 'utf-8')).toBe(once);
  });
});

// G16: errorHandler.ts (auto-tier) no longer re-exports AppError, so an app's own files that import it
// from there stop compiling: one row per file, naming the new import.
describe('appendAppErrorTodo', () => {
  let consumer;
  beforeEach(() => {
    consumer = mkdtempSync(join(tmpdir(), 'apperror-todo-'));
  });
  afterEach(() => removeScratch(consumer));

  const write = (rel, text) => {
    mkdirSync(dirname(join(consumer, rel)), { recursive: true });
    writeFileSync(join(consumer, rel), text);
  };
  const todo = () => readFileSync(join(consumer, 'UPGRADE_TODO.md'), 'utf-8');

  it('writes one row per file that imports AppError from errorHandler, naming the new import', () => {
    write('server/src/routes/a.ts', "import { AppError } from '../middleware/errorHandler.js';\n");
    write('server/src/routes/b.ts', "import type { AppError, Other } from '../middleware/errorHandler';\n");
    write('server/src/middleware/auth.ts', "import {\n  errorHandler,\n  AppError,\n} from './errorHandler.js';\n");
    expect(appendAppErrorTodo(consumer)).toBe(true);
    for (const file of ['routes/a.ts', 'routes/b.ts', 'middleware/auth.ts']) {
      expect(todo()).toContain(`| \`server/src/${file}\` |`);
    }
    expect(todo()).toContain("import { AppError } from '@helpers/AppError.js';");
    expect(todo()).toContain('no longer re-exports');
  });

  it('writes nothing for files that do not need it', () => {
    write('server/src/middleware/errorHandler.ts', "export { AppError };\nimport { AppError } from './errorHandler.js';\n");
    write('server/src/routes/ok1.ts', "import { AppError } from '@helpers/AppError.js';\n");
    write('server/src/routes/ok2.ts', "import { errorHandler } from '../middleware/errorHandler.js';\n");
    write('server/src/routes/ok3.ts', "import { AppError } from '../middleware/errorHandlerExtra.js';\n");
    write('server/src/routes/ok4.ts', "import { MyAppError } from '../middleware/errorHandler.js';\n");
    write('server/src/node_modules/dep/x.ts', "import { AppError } from './errorHandler.js';\n");
    write('server/src/notes.md', "import { AppError } from './errorHandler.js';\n");
    expect(appendAppErrorTodo(consumer)).toBe(false);
    expect(existsSync(join(consumer, 'UPGRADE_TODO.md'))).toBe(false);
  });

  it('writes nothing without a server, and does not repeat a row when run twice', () => {
    expect(appendAppErrorTodo(consumer)).toBe(false);
    write('server/src/routes/a.ts', "import { AppError } from '../middleware/errorHandler.js';\n");
    appendAppErrorTodo(consumer);
    const once = todo();
    appendAppErrorTodo(consumer);
    expect(todo()).toBe(once);
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
    // The 0.4.18 server has no @helpers/@test paths and no vitest alias: the tool must say what to add.
    const todoText = readFileSync(join(app, 'UPGRADE_TODO.md'), 'utf-8');
    expect(todoText).toContain('server/tsconfig.json');
    expect(todoText).toContain('server/vitest.config.ts');
    // errorHandler.ts no longer re-exports AppError, and the 0.4.18 test imports it from there.
    expect(todoText).toContain('| `server/src/middleware/errorHandler.test.ts` |');

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

    // The duplicates gate: its config arrived, the binary installed, and it runs. The app's own demo code may
    // hold clones, so exit 0 or a clone count is a pass; a crash or missing config prints no count.
    expect(existsSync(join(app, '.jscpd.json'))).toBe(true);
    expect(existsSync(join(app, '.jscpd.tests.json'))).toBe(true);
    expect(readJson(app, 'package.json').scripts.dup).toContain('jscpd');
    const dup = run('npx', ['--no-install', 'jscpd', '--config', '.jscpd.json'], app, 170_000);
    const dupOut = dup.stdout + dup.stderr;
    const clones = dupOut.match(/Found (\d+)(?: exact)? clones/);
    expect(clones, `jscpd: ${dupOut.slice(-1500)}`).not.toBeNull();
    report.jscpd = Number(clones[1]);
    console.log(`0.4.18 app after upgrade: ${JSON.stringify(report)}`);
  });
});
