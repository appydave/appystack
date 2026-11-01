// @vitest-environment node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { treeFiles } from '@/test/treeFiles';

// vitest runs with the client workspace as cwd; eslint.config.js sits one level up, at the template root.
const root = resolve(process.cwd(), '..');
const ERROR_SEVERITY = 2;
const LINTABLE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;

// The reviewed gate blocks are every `quality/*` block of eslint.config.js (exemptions included), so a
// new gate joins this pin by itself. What each file gets from those blocks alone is the expectation,
// computed by ESLint, so rule defaults are added the same way on both sides and options compare exactly.
const loaded: { default: { name?: string; rules?: Record<string, unknown> }[] } = await import(
  pathToFileURL(resolve(root, 'eslint.config.js')).href
);
const gateBlocks = loaded.default.filter((block) => block.name?.startsWith('quality/'));
const gateRules = [...new Set(gateBlocks.flatMap((block) => Object.keys(block.rules ?? {})))];
const reviewed = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: gateBlocks });
const actual = new ESLint({ cwd: root });
const files = treeFiles(root).filter((file) => LINTABLE.test(file));

describe('the effective ESLint config of every lintable file in the tree', () => {
  it('reads the gate rules and the file list (non-vacuous), every gate rule at error in production code', async () => {
    const config = await reviewed.calculateConfigForFile(resolve(root, 'server/src/index.ts'));
    const notError = gateRules.filter((rule) => {
      const value: unknown = config?.rules?.[rule];

      return !Array.isArray(value) || value[0] !== ERROR_SEVERITY;
    });

    expect(gateRules.length).toBeGreaterThanOrEqual(15);
    expect(files.length).toBeGreaterThan(50);
    expect(notError).toEqual([]);
  });

  // calculateConfigForFile returns undefined for a file the config ignores.
  it('ignores no lintable file, and ignores inline disable comments in all of them', async () => {
    const bad: string[] = [];

    for (const file of files) {
      const config = await actual.calculateConfigForFile(resolve(root, file));

      if (config?.linterOptions?.noInlineConfig !== true) {
        bad.push(file);
      }
    }

    expect(bad).toEqual([]);
  });

  it('gives every file exactly the gate rules, severities and options the reviewed blocks give it', async () => {
    const wrong: string[] = [];

    for (const file of files) {
      const path = resolve(root, file);
      const rules = (await actual.calculateConfigForFile(path))?.rules ?? {};
      const want = (await reviewed.calculateConfigForFile(path))?.rules ?? {};

      for (const rule of gateRules) {
        if (!isDeepStrictEqual(rules[rule], want[rule])) {
          wrong.push(`${file}: ${rule}`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });
});
