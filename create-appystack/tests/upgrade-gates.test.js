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
import { mergeServerAliases } from '../bin/lib/alias-merge.js';
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

  it('replaces the first dead-code gate script (workspace src only) with the one that also cruises scripts/, e2e/ and root files', () => {
    writeJson(consumer, 'package.json', {
      scripts: {
        deadcode:
          "grep -rqE '@(public|internal|beta|alias)' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.cjs' --include='*.mts' --include='*.cts' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=coverage . ; [ $? -eq 1 ] && knip && (cd client && depcruise -c ../.dependency-cruiser.cjs --ts-config tsconfig.json src) && (cd server && depcruise -c ../.dependency-cruiser.cjs --ts-config tsconfig.json src) && (cd shared && depcruise -c ../.dependency-cruiser.cjs --ts-config tsconfig.json src)",
      },
    });
    const changed = mergeGatePackage(consumer, template);
    expect(changed).toContain('scripts.deadcode');
    expect(readJson(consumer, 'package.json').scripts.deadcode).toBe(templatePkg.scripts.deadcode);
  });

  it('replaces the P4 dead-code script (root cruise skipping build/dist at any depth) with the anchored one', () => {
    writeJson(consumer, 'package.json', { scripts: { deadcode: "grep -rqE '@(public|internal|beta|alias)' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.cjs' --include='*.mts' --include='*.cts' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=coverage . ; [ $? -eq 1 ] && knip && (cd client && depcruise -c ../.dependency-cruiser.cjs --ts-config tsconfig.json src) && (cd server && depcruise -c ../.dependency-cruiser.cjs --ts-config tsconfig.json src) && (cd shared && depcruise -c ../.dependency-cruiser.cjs --ts-config tsconfig.json src) && depcruise -c .dependency-cruiser.cjs -x '^(client|server|shared)/|(^|/)(node_modules|dist|build|coverage|playwright-report|test-results)/' ." } });
    const changed = mergeGatePackage(consumer, template);
    expect(changed).toContain('scripts.deadcode');
    expect(readJson(consumer, 'package.json').scripts.deadcode).toBe(templatePkg.scripts.deadcode);
  });

  // The lint script create-appystack 0.5.0 and 0.5.1 shipped (identical in both tarballs): the guard plus
  // Oxlint and ESLint, before `--max-warnings 0`. Written out here, not imported, so it pins the old value.
  const LINT_050 =
    "grep -rqE '(eslint|oxlint)-disable' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.cjs' --include='*.mts' --include='*.cts' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=coverage --exclude-dir=playwright-report --exclude-dir=test-results --exclude-dir=.claude . ; [ $? -eq 1 ] && oxlint --deny-warnings && eslint .";

  it('gives a 0.5.0 or 0.5.1 app the current lint script, with --max-warnings 0 and the guard', () => {
    const real = readJson(TEMPLATE, 'package.json');
    for (const version of ['0.5.0', '0.5.1']) {
      const app = join(root, `app-${version}`);
      mkdirSync(app);
      writeJson(app, 'package.json', { scripts: { lint: LINT_050, 'lint:fix': 'oxlint --fix && eslint . --fix' } });
      const changed = mergeGatePackage(app, TEMPLATE);
      expect(changed, version).toContain('scripts.lint');
      const lint = readJson(app, 'package.json').scripts.lint;
      expect(lint, version).toBe(real.scripts.lint);
      expect(lint, version).toContain('eslint . --max-warnings 0');
      expect(lint, version).toContain("grep -rqE '(eslint|oxlint)-disable'");
      expect(changed, version).not.toContain('scripts.lint:fix'); // already current
    }
  });

  it('leaves a 0.5.x lint script the app has edited and writes a row', () => {
    writeJson(consumer, 'package.json', { scripts: { lint: `${LINT_050} --quiet` } });
    mergeGatePackage(consumer, template);
    expect(readJson(consumer, 'package.json').scripts.lint).toBe(`${LINT_050} --quiet`);
    expect(readFileSync(join(consumer, 'UPGRADE_TODO.md'), 'utf-8')).toContain('scripts.lint');
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
// (never-tier) tsconfig and vitest config, so the tool adds the missing aliases into them and nothing else.
describe('mergeServerAliases', () => {
  let consumer;
  beforeEach(() => {
    consumer = mkdtempSync(join(tmpdir(), 'alias-merge-'));
  });
  afterEach(() => removeScratch(consumer));

  const oldTsconfig = `{
  "extends": "@appydave/appystack-config/typescript/node.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@routes/*": ["src/routes/*"],
      "@config/*": ["src/config/*"]
    }
  },
  "include": ["src/**/*"]
}
`;
  const oldVitest = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 10000,
    coverage: { thresholds: { lines: 80 } },
  },
});
`;
  const write = (rel, text) => {
    mkdirSync(dirname(join(consumer, rel)), { recursive: true });
    writeFileSync(join(consumer, rel), text);
  };
  const read = (rel) => readFileSync(join(consumer, rel), 'utf-8');
  const todo = () => read('UPGRADE_TODO.md');
  const TSCONFIG = 'server/tsconfig.json';
  const VITEST = 'server/vitest.config.ts';

  it('adds the missing paths and aliases to a 0.4.x server and keeps every other value', () => {
    write(TSCONFIG, oldTsconfig);
    write(VITEST, oldVitest);
    expect(mergeServerAliases(consumer)).toBe(true);
    const tsconfig = JSON.parse(read(TSCONFIG));
    expect(tsconfig.compilerOptions.paths).toEqual({
      '@helpers/*': ['src/helpers/*'],
      '@test/*': ['src/test/*'],
      '@routes/*': ['src/routes/*'],
      '@config/*': ['src/config/*'],
    });
    expect(tsconfig.extends).toBe('@appydave/appystack-config/typescript/node.json');
    expect(tsconfig.include).toEqual(['src/**/*']);
    const vitest = read(VITEST);
    expect(vitest).toContain("import path from 'node:path';");
    for (const [name, dir] of [['@config', 'src/config'], ['@helpers', 'src/helpers'], ['@test', 'src/test']]) {
      expect(vitest).toContain(`'${name}': path.resolve(__dirname, '${dir}')`);
    }
    expect(vitest).toContain('testTimeout: 10000,\n    coverage: { thresholds: { lines: 80 } },');
    // merged files need no row of their own; the app's own ../ imports still do
    expect(todo()).not.toContain(TSCONFIG);
    expect(todo()).not.toContain(VITEST);
    expect(todo()).toContain('Rewrite each to an alias');
  });

  it('writes nothing for an app that already has them, and nothing without a server', () => {
    expect(mergeServerAliases(consumer)).toBe(false);
    const tsconfig = '{ "compilerOptions": { "paths": { "@config/*": [], "@helpers/*": [], "@test/*": [] } } }';
    const vitest = "export default defineConfig({ resolve: { alias: { '@config': 1, '@helpers': 2, '@test': 3 } } });";
    write(TSCONFIG, tsconfig);
    write(VITEST, vitest);
    expect(mergeServerAliases(consumer)).toBe(false);
    expect([read(TSCONFIG), read(VITEST)]).toEqual([tsconfig, vitest]);
    expect(existsSync(join(consumer, 'UPGRADE_TODO.md'))).toBe(false);
  });

  it('adds into an existing alias object rather than a second resolve block', () => {
    write(VITEST, oldVitest.replace('test: {', "resolve: { alias: { '@config': 'x' } },\n  test: {"));
    expect(mergeServerAliases(consumer)).toBe(true);
    const vitest = read(VITEST);
    expect(vitest.match(/resolve\s*:/g)).toHaveLength(1);
    expect(vitest).toContain("'@config': 'x'");
    expect(vitest).toContain("'@helpers': path.resolve(__dirname, 'src/helpers')");
    expect(vitest).not.toContain("'@config': path.resolve");
  });

  it('reuses an existing path import and fills an empty paths object with valid JSON', () => {
    write(VITEST, `import path from 'path';\n${oldVitest}`);
    write(TSCONFIG, '{ "compilerOptions": { "paths": {} } }');
    mergeServerAliases(consumer);
    expect(read(VITEST).match(/import path/g)).toHaveLength(1);
    expect(Object.keys(JSON.parse(read(TSCONFIG)).compilerOptions.paths)).toEqual(['@config/*', '@helpers/*', '@test/*']);
  });

  it('reads the aliases by exact name', () => {
    write(TSCONFIG, '{ "compilerOptions": { "paths": { "@config/*": [], "@helpers/*": [], "@testing/*": [] } } }');
    write(VITEST, `import { env } from "@config/env.js";\n${oldVitest.replace('test: {', 'resolve: { alias: { "@helpers": 2, "@test": 3 } },\n  test: {')}`);
    expect(mergeServerAliases(consumer)).toBe(true); // an import of @config/ is not the alias
    expect(JSON.parse(read(TSCONFIG)).compilerOptions.paths).toHaveProperty(['@test/*'], ['src/test/*']); // @testing/* is not @test/*
    expect(read(VITEST)).toContain("'@config': path.resolve");
    expect(read(VITEST)).not.toContain("'@helpers': path.resolve");
    expect(read(VITEST)).not.toContain("'@test': path.resolve");
  });

  it('leaves a file it cannot patch safely untouched and writes the exact lines in a row', () => {
    const noPaths = '{ "compilerOptions": { "baseUrl": "." } }';
    const arrayAlias = "export default defineConfig({ resolve: { alias: [] } });";
    write(TSCONFIG, noPaths);
    write(VITEST, arrayAlias);
    expect(mergeServerAliases(consumer)).toBe(true);
    expect([read(TSCONFIG), read(VITEST)]).toEqual([noPaths, arrayAlias]);
    expect(todo()).toContain('`"@config/*": ["src/config/*"]`, `"@helpers/*": ["src/helpers/*"]`, `"@test/*": ["src/test/*"]`');
    expect(todo()).toContain("`'@config': path.resolve(__dirname, 'src/config')`");
    expect(todo()).toContain('Rewrite each to an alias');
  });

  it('does not touch a vitest config that has resolve but no defineConfig call to patch', () => {
    const custom = "const config = { resolve: { alias } };\nexport default config;\n";
    write(VITEST, custom);
    expect(mergeServerAliases(consumer)).toBe(true);
    expect(read(VITEST)).toBe(custom);
    expect(todo()).toContain(VITEST);
  });

  // The judge's two corrupting shapes (cli-a-judge r1) and the low ones.
  it('adds a path binding when the config only has a NAMED import from node:path', () => {
    write(VITEST, `import { resolve } from 'node:path';\n${oldVitest}`);
    mergeServerAliases(consumer);
    const vitest = read(VITEST);
    expect(vitest).toContain("import { resolve } from 'node:path';");
    expect(vitest).toContain("import path from 'node:path';"); // the aliases call path.resolve
    expect(vitest.indexOf("import path from")).toBeLessThan(vitest.indexOf('path.resolve(__dirname'));
  });

  it('skips a commented-out "paths" block and patches the real one, keeping the comment as it was', () => {
    const commented = '    // "paths": { "@old/*": ["x"] },\n    /* "paths": {\n       "@x/*": ["y"] } */\n';
    write(TSCONFIG, oldTsconfig.replace('    "baseUrl": ".",\n', `    "baseUrl": ".",\n${commented}`));
    mergeServerAliases(consumer);
    const text = read(TSCONFIG);
    expect(text).toContain(commented);
    const live = text.replace(commented, '');
    expect(Object.keys(JSON.parse(live).compilerOptions.paths)).toEqual(['@helpers/*', '@test/*', '@routes/*', '@config/*']);
  });

  it('leaves a tsconfig whose only "paths" is commented out untouched and writes a row', () => {
    const onlyComment = '{ "compilerOptions": {\n  // "paths": {\n  "baseUrl": "." } }';
    write(TSCONFIG, onlyComment);
    mergeServerAliases(consumer);
    expect(read(TSCONFIG)).toBe(onlyComment);
    expect(todo()).toContain(TSCONFIG);
  });

  it('skips a commented-out alias object and counts a commented-out alias entry as missing', () => {
    write(VITEST, oldVitest.replace('test: {', "// resolve: { alias: {\n  // '@helpers': 'x',\n  test: {"));
    mergeServerAliases(consumer);
    const vitest = read(VITEST);
    expect(vitest).toContain("// resolve: { alias: {\n  // '@helpers': 'x',");
    expect(vitest.match(/^\s*resolve: \{$/gm)).toHaveLength(1); // a real block, after the comment
    expect(vitest).toContain("'@helpers': path.resolve(__dirname, 'src/helpers'),");
  });

  it('is not fooled by // inside a string, and keeps a leading triple-slash directive first', () => {
    write(TSCONFIG, oldTsconfig.replace('"extends": ', '"$schema": "https://json.schemastore.org/tsconfig", "extends": '));
    write(VITEST, `/// <reference types="vitest" />\n${oldVitest}`);
    mergeServerAliases(consumer);
    expect(JSON.parse(read(TSCONFIG)).compilerOptions.paths).toHaveProperty(['@test/*']);
    expect(read(VITEST).startsWith('/// <reference types="vitest" />\nimport path from')).toBe(true);
  });

  it('writes CRLF files with CRLF line endings throughout', () => {
    write(TSCONFIG, oldTsconfig.replaceAll('\n', '\r\n'));
    write(VITEST, oldVitest.replaceAll('\n', '\r\n'));
    mergeServerAliases(consumer);
    for (const rel of [TSCONFIG, VITEST]) expect(read(rel), rel).not.toMatch(/(?<!\r)\n/);
  });

  it('is idempotent: a second run changes nothing and reports nothing', () => {
    write(TSCONFIG, oldTsconfig);
    write(VITEST, oldVitest);
    mergeServerAliases(consumer);
    const once = [read(TSCONFIG), read(VITEST), todo()];
    expect(mergeServerAliases(consumer)).toBe(false);
    expect([read(TSCONFIG), read(VITEST), todo()]).toEqual(once);
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

  it('installs, lints, typechecks and tests without an upgrade-caused load error', { timeout: 180_000 }, (ctx) => {
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
    // Customise the old server vitest config the way an app plausibly does: a named import from node:path
    // and a commented-out alias block. The merge must still produce a config that loads.
    const vitestPath = join(app, 'server/vitest.config.ts');
    writeFileSync(
      vitestPath,
      `import { resolve } from 'node:path';\n// resolve: { alias: {\n${readFileSync(vitestPath, 'utf-8')}`,
    );
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
    // The 0.4.18 server has no @helpers/@test paths and no vitest alias: the tool adds them itself, keeping the rest.
    const todoText = readFileSync(join(app, 'UPGRADE_TODO.md'), 'utf-8');
    expect(readFileSync(join(app, 'server/tsconfig.json'), 'utf-8')).toContain('"@helpers/*": ["src/helpers/*"]');
    expect(readFileSync(join(app, 'server/tsconfig.json'), 'utf-8')).toContain('"@services/*": ["src/services/*"]');
    // the alias block must be live code, not text inside the customised config's commented-out `resolve:` line
    const liveVitest = readFileSync(join(app, 'server/vitest.config.ts'), 'utf-8').replace(/\/\/[^\n]*/g, '');
    expect(liveVitest).toContain("'@helpers': path.resolve(");
    expect(liveVitest).toMatch(/^\s*resolve: \{$/m); // a real block, not entries spilled out of the comment
    expect(todoText).not.toContain('server/tsconfig.json');
    expect(todoText).not.toContain('server/vitest.config.ts');
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

    // Typecheck and tests must load and run. The old app's own code has findings the upgrade cannot fix (its server
    // lacks @appydave/core, its client lacks @testing-library/dom, one test imports AppError from errorHandler):
    // those are counted and reported. An alias that did not resolve is the upgrade's fault and fails here.
    expect(run('npm', ['run', 'build', '-w', 'shared'], app, 170_000).status).toBe(0);
    const tc = run('npm', ['run', 'typecheck'], app, 170_000);
    const tcOut = tc.stdout + tc.stderr;
    expect(tcOut, `typecheck: ${tcOut.slice(-1500)}`).not.toMatch(/TS2307: Cannot find module '@(config|helpers|test)\//);
    expect(tc.status === 0 || /error TS\d+/.test(tcOut), `typecheck: ${tcOut.slice(-1500)}`).toBe(true);
    report.typecheck = (tcOut.match(/error TS\d+/g) ?? []).length;
    const unit = run('npm', ['test'], app, 170_000);
    const unitOut = unit.stdout + unit.stderr;
    expect(unitOut, `test: ${unitOut.slice(-1500)}`).not.toMatch(/(Cannot find package|Failed to resolve import) ['"]@(config|helpers|test)\//);
    expect(unitOut, `test: ${unitOut.slice(-1500)}`).not.toMatch(/path is not defined/); // the patched config loaded
    expect(unitOut, `test: ${unitOut.slice(-1500)}`).toMatch(/Test Files .*\(\d+\)/); // vitest ran and printed its summary
    report.vitestRunsWithFailures = (unitOut.match(/(\d+) failed \| \d+ passed \(\d+\)/g) ?? []).length;
    console.log(`0.4.18 app after upgrade: ${JSON.stringify(report)}`);
  });
});
