import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
const OXLINT = /oxlint --deny-warnings && /;
const ESLINT = /eslint \. --max-warnings 0$/;

describe('the lint script in package.json', () => {
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
