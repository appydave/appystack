// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// vitest runs with the client workspace as cwd; eslint.config.js sits one level up, at the template root.
const root = resolve(process.cwd(), '..');
const eslint = new ESLint({ cwd: root });
const ERROR_SEVERITY = 2;
const SEVERITIES: Record<string, number> = { off: 0, warn: 1, error: ERROR_SEVERITY };
const LINTABLE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const isTest = (file: string): boolean => /\.test\.|(^|\/)test\//.test(file);

// The gate rules are every rule named by a `quality/*` block of eslint.config.js, so a new gate joins
// this pin by itself. The declared value is the last block of the rule that is not an exemption.
const loaded: { default: { name?: string; rules?: Record<string, unknown> }[] } = await import(
  pathToFileURL(resolve(root, 'eslint.config.js')).href
);
const gateBlocks = loaded.default.filter(
  (block) => block.name?.startsWith('quality/') && !block.name.endsWith('-exempt')
);
const declared = new Map<string, unknown>();

for (const block of gateBlocks) {
  for (const [rule, value] of Object.entries(block.rules ?? {})) {
    declared.set(rule, value);
  }
}

// Where a gate rule is off by design, by name or by kind. The key is the rule; the test is the path.
const EXEMPT: [string, (file: string) => boolean][] = [
  ['no-magic-numbers', isTest],
  ['sonarjs/cognitive-complexity', isTest],
  ['sonarjs/expression-complexity', isTest],
  ['no-magic-numbers', (file) => file === 'server/src/config/env.ts'],
  ['exports/no-reexport', (file) => file === 'shared/src/index.ts'],
];
// The two vitest configs keep the rule but with the size selectors only (they import ../vitest.shared).
const SELECTORS_ONLY = ['client/vitest.config.ts', 'server/vitest.config.ts'];

const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((file) => LINTABLE.test(file));

function severityOf(value: unknown): number {
  const level = Array.isArray(value) ? value[0] : value;

  // A rule a file's blocks never mention is off.
  return typeof level === 'string' ? (SEVERITIES[level] ?? -1) : Number(level ?? 0);
}

describe('the effective ESLint config of every tracked lintable file', () => {
  it('reads the gate rules and the file list (non-vacuous)', () => {
    expect(declared.size).toBeGreaterThanOrEqual(15);
    expect(tracked.length).toBeGreaterThan(50);
  });

  // calculateConfigForFile returns undefined for a file the config ignores.
  it('ignores no tracked lintable file, and ignores inline disable comments in all of them', async () => {
    const bad: string[] = [];

    for (const file of tracked) {
      const config = await eslint.calculateConfigForFile(resolve(root, file));

      if (config?.linterOptions?.noInlineConfig !== true) {
        bad.push(file);
      }
    }

    expect(bad).toEqual([]);
  });

  it('keeps every gate rule at error with its declared options, except where an exemption says off', async () => {
    const wrong: string[] = [];

    for (const file of tracked) {
      const rules = (await eslint.calculateConfigForFile(resolve(root, file)))?.rules ?? {};

      for (const [rule, expected] of declared) {
        const actual: unknown = rules[rule];
        const exempt = EXEMPT.some(([name, applies]) => name === rule && applies(file));
        const selectorsOnly = rule === 'no-restricted-syntax' && SELECTORS_ONLY.includes(file);
        const ok = exempt
          ? severityOf(actual) === 0
          : severityOf(actual) === ERROR_SEVERITY && (selectorsOnly || matches(actual, expected));

        if (!ok) {
          wrong.push(`${file}: ${rule}`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });
});

// Compare options only (the severity is checked apart). The effective value may add the rule's
// defaults, so the declared options must be a prefix and subset of it.
function matches(actual: unknown, expected: unknown): boolean {
  const options = (value: unknown): unknown[] => (Array.isArray(value) ? value.slice(1) : []);

  const want = options(expected);

  try {
    expect(options(actual).slice(0, want.length)).toMatchObject(want);

    return true;
  } catch {
    return false;
  }
}
