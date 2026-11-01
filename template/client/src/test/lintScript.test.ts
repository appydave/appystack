import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// vitest runs with the client workspace as cwd; package.json and eslint.config.js sit one level up.
const root = resolve(process.cwd(), '..');
const manifest: { scripts: { lint: string } } = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf8')
);
const lint = manifest.scripts.lint;

// What `npm run lint` must do, in this order. Each step ends the run when it fails, so dropping,
// reordering or neutering one switches that whole gate off while every other test stays green.
const GUARD = /^grep -rqE '\(eslint\|oxlint\)-disable'[^;&|]*; \[ \$\? -eq 1 \] && /;
// The whole script, character for character. The guard's flag list and search target decide which
// files it reads: loosening any of them (a different --include, an --exclude-dir, another target)
// switches the guard off while it still looks present. Change the script and this line together.
const EXACT_LINT =
  "grep -rqE '(eslint|oxlint)-disable' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.cjs' --include='*.mts' --include='*.cts' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=coverage --exclude-dir=playwright-report --exclude-dir=test-results --exclude-dir=.claude . ; [ $? -eq 1 ] && oxlint --deny-warnings && eslint . --max-warnings 0";
const OXLINT = /oxlint --deny-warnings && /;
const ESLINT = /eslint \. --max-warnings 0$/;

describe('the lint script in package.json', () => {
  it('is exactly the reviewed script: guard flags, search target and the two linters', () => {
    expect(
      lint,
      'The lint script changed. If the guard now reads fewer files, or a linter lost a flag, restore it; if the change is intended, update EXACT_LINT in this test in the same PR.'
    ).toBe(EXACT_LINT);
  });

  it('starts with the disable-directive guard: search the sources for a lint-disable directive, then require that nothing was found (exit 1)', () => {
    expect(
      lint,
      "Restore `grep -rqE '(eslint|oxlint)-disable' <flags> . ; [ $? -eq 1 ] &&` at the start of the lint script."
    ).toMatch(GUARD);
  });

  it('runs oxlint with --deny-warnings, so an Oxlint warning fails the build', () => {
    expect(lint, 'Restore `oxlint --deny-warnings &&` in the lint script.').toMatch(OXLINT);
  });

  it('runs eslint with --max-warnings 0 last, so an ESLint warning fails the build', () => {
    expect(lint, 'End the lint script with `eslint . --max-warnings 0`.').toMatch(ESLINT);
  });

  it('runs the three steps in order: guard, then oxlint, then eslint', () => {
    const inOrder = new RegExp(`${GUARD.source}${OXLINT.source}${ESLINT.source}`);

    expect(
      lint,
      'Keep the lint script as: guard ; [ $? -eq 1 ] && oxlint --deny-warnings && eslint . --max-warnings 0.'
    ).toMatch(inOrder);
  });
});

describe('inline lint directives are ignored by ESLint', () => {
  it('still reports a rule that a disable comment tries to switch off', async () => {
    const eslint = new ESLint({ cwd: root });
    // Built in pieces: the lint script rejects any source file that spells the directive out.
    const directive = ['eslint', 'disable-next-line no-magic-numbers'].join('-');
    const source = `// ${directive}\nexport const timeout = 15 * 60 * 1000;\n`;
    const [result] = await eslint.lintText(source, {
      filePath: resolve(root, 'client/src/probe.ts'),
    });
    const ids = (result?.messages ?? []).map((message) => message.ruleId);

    expect(
      ids,
      'Restore `linterOptions: { noInlineConfig: true }` in eslint.config.js: a gate the code can switch off is not a gate.'
    ).toContain('no-magic-numbers');
  });
});

describe('the disable-directive guard, run for real', () => {
  // Everything before `; [ $? -eq 1 ]` is the search command. It exits 0 when it finds a directive.
  const search = lint.slice(0, lint.indexOf(' ; [ $? -eq 1 ]'));
  const directive = (tool: string) => `// ${tool}-disable-next-line no-debugger\ndebugger;\n`;

  const searchExit = (file: string, content: string): number => {
    const dir = mkdtempSync(join(tmpdir(), 'lint-guard-'));

    try {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), content);

      return spawnSync('sh', ['-c', search], { cwd: dir, stdio: 'ignore' }).status ?? -1;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it.each([
    'server/src/a.ts',
    'client/src/b.tsx',
    'shared/src/c.ts',
    'scripts/d.mjs',
    'e2e/e.ts',
    'f.cjs',
  ])('finds a directive in %s (grep exits 0, so the lint script stops)', (file) => {
    expect(searchExit(file, directive('eslint'))).toBe(0);
    expect(searchExit(file, directive('oxlint'))).toBe(0);
  });

  it.each(['node_modules/pkg/index.js', 'server/dist/x.js', 'coverage/y.js'])(
    'ignores build and dependency output: %s',
    (file) => {
      expect(searchExit(file, directive('eslint'))).toBe(1);
    }
  );

  it('finds nothing in a clean tree (grep exits 1, so the lint script goes on)', () => {
    expect(searchExit('server/src/a.ts', 'export const a = 1;\n')).toBe(1);
  });
});
