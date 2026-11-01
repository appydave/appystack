import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// vitest runs with the client workspace as cwd; eslint.config.js sits one level up, at the template root.
const root = resolve(process.cwd(), '..');
const ERROR = 2;
const eslint = new ESLint({ cwd: root });

async function ruleIdsFor(source: string, file = 'client/src/probe.ts'): Promise<string[]> {
  const [result] = await eslint.lintText(source, { filePath: resolve(root, file) });

  // Only errors count: a rule downgraded to a warning prints but does not fail the build.
  return (result?.messages ?? [])
    .filter((message) => message.severity === ERROR)
    .map((message) => message.ruleId ?? 'parse-error');
}

const statements = (count: number) =>
  Array.from({ length: count }, (_, index) => `const v${index} = ${index};`).join('\n');

// A call or function whose text spans exactly `total` lines, opener and closer included.
const wrapped = (opener: string, closer: string, total: number) =>
  `${opener}\n${statements(total - 2)}\n${closer}\n`;

const TEST_FILE = 'client/src/probe.test.ts';
const FUNCTION_RULE = 'size/max-lines-per-function';
const only = (ids: string[], rule: string) => ids.filter((id) => id === rule);

describe('G04 size gate, run through the real eslint.config.js', () => {
  describe('functions: at most 60 lines', () => {
    it('allows a 60-line production function and rejects a 61-line one', async () => {
      const sixty = await ruleIdsFor(wrapped('export function f() {', '}', 60));
      const sixtyOne = await ruleIdsFor(wrapped('export function f() {', '}', 61));

      expect(only(sixty, FUNCTION_RULE)).toHaveLength(0);
      expect(only(sixtyOne, FUNCTION_RULE)).toHaveLength(1);
    });

    it.each(['probe.js', 'probe.mjs', 'probe.tsx'])('also checks %s files', async (name) => {
      const source = wrapped('export function f() {', '}', 61);

      expect(only(await ruleIdsFor(source, `client/src/${name}`), FUNCTION_RULE)).toHaveLength(1);
    });

    it('checks an IIFE', async () => {
      const source = wrapped('(() => {', '})();', 61);

      expect(only(await ruleIdsFor(source), FUNCTION_RULE)).toHaveLength(1);
    });

    it('does not count blank lines or comments', async () => {
      const padded = `export function f() {\n${statements(29)}\n\n// c\n\n/* b */\n${statements(29)}\n}\n`;

      expect(only(await ruleIdsFor(padded), FUNCTION_RULE)).toHaveLength(0);
    });

    it('keeps an it() callback checked, even inside describe', async () => {
      const source = `describe('x', () => {\n${wrapped("it('y', () => {", '});', 61)}});\n`;

      expect(only(await ruleIdsFor(source, TEST_FILE), FUNCTION_RULE)).toHaveLength(1);
    });
  });

  describe('describe callbacks are exempt', () => {
    it.each([
      ["describe('x', () => {", '});'],
      ["describe.skip('x', () => {", '});'],
      ["describe.only('x', () => {", '});'],
      ["describe.each([1, 2])('x', () => {", '});'],
      ["describe.each`a`('x', () => {", '});'],
      ["describe('x', function () {", '});'],
    ])('allows a 61-line %s callback', async (opener, closer) => {
      const ids = await ruleIdsFor(wrapped(opener, closer, 61), TEST_FILE);

      expect(only(ids, FUNCTION_RULE)).toHaveLength(0);
    });

    it('exempts a describe callback in a test file only', async () => {
      const source = wrapped("describe('x', () => {", '});', 61);

      expect(only(await ruleIdsFor(source, TEST_FILE), FUNCTION_RULE)).toHaveLength(0);
      expect(only(await ruleIdsFor(source), FUNCTION_RULE)).toHaveLength(1);
    });

    it('exempts files under a test/ folder', async () => {
      const source = wrapped("describe('x', () => {", '});', 61);

      expect(
        only(await ruleIdsFor(source, 'client/src/test/probe.ts'), FUNCTION_RULE)
      ).toHaveLength(0);
    });

    it('does not exempt a production function named describe', async () => {
      const source = wrapped('export function describe(name: string, fn: () => void) {', '}', 61);

      expect(only(await ruleIdsFor(source, TEST_FILE), FUNCTION_RULE)).toHaveLength(1);
    });

    it('does not exempt a describe callback in production code', async () => {
      const source = wrapped("describe('x', () => {", '});', 61);

      expect(
        only(await ruleIdsFor(source, 'server/src/latest/probe.ts'), FUNCTION_RULE)
      ).toHaveLength(1);
    });

    it('does not exempt other calls that take a callback', async () => {
      const ids = await ruleIdsFor(wrapped("suite('x', () => {", '});', 61), TEST_FILE);

      expect(only(ids, FUNCTION_RULE)).toHaveLength(1);
    });
  });

  describe('parameters: at most 4', () => {
    it('allows four and rejects five', async () => {
      const four = await ruleIdsFor('export const f = (a: 1, b: 2, c: 3, d: 4) => a;\n');
      const five = await ruleIdsFor('export const f = (a: 1, b: 2, c: 3, d: 4, e: 5) => a;\n');

      expect(only(four, 'max-params')).toHaveLength(0);
      expect(only(five, 'max-params')).toHaveLength(1);
    });
  });

  describe('files: at most 300 lines, blanks and comments not counted', () => {
    it('rejects 301 counted lines and allows 300', async () => {
      const three = await ruleIdsFor(`${statements(300)}\n`);
      const four = await ruleIdsFor(`${statements(301)}\n`);

      expect(only(three, 'max-lines')).toHaveLength(0);
      expect(only(four, 'max-lines')).toHaveLength(1);
    });

    it('ignores blank and comment lines', async () => {
      const source = `${statements(300)}\n${'\n// note\n'.repeat(50)}`;

      expect(only(await ruleIdsFor(source), 'max-lines')).toHaveLength(0);
    });
  });

  describe('members: at most 30', () => {
    const members = (count: number, line: (index: number) => string) =>
      Array.from({ length: count }, (_, index) => line(index)).join('\n');
    const memberErrors = async (source: string) =>
      only(await ruleIdsFor(source), 'no-restricted-syntax');

    it('applies to interfaces', async () => {
      const make = (count: number) =>
        `export interface I {\n${members(count, (i) => `  m${i}: number;`)}\n}\n`;

      expect(await memberErrors(make(30))).toHaveLength(0);
      expect(await memberErrors(make(31))).toHaveLength(1);
    });

    it('applies to classes', async () => {
      const make = (count: number) =>
        `export class C {\n${members(count, (i) => `  p${i} = ${i};`)}\n}\n`;

      expect(await memberErrors(make(30))).toHaveLength(0);
      expect(await memberErrors(make(31))).toHaveLength(1);
    });

    it('applies to object types', async () => {
      const make = (count: number) =>
        `export type T = {\n${members(count, (i) => `  t${i}: number;`)}\n};\n`;

      expect(await memberErrors(make(30))).toHaveLength(0);
      expect(await memberErrors(make(31))).toHaveLength(1);
    });
  });
  // The gates run on every workspace, not only the client. A rule switched off for one folder must fail here.
  describe.each(['client/src', 'server/src', 'shared/src'])('in %s', (dir) => {
    const at = (name: string) => `${dir}/${name}`;
    const memberLines = (count: number) =>
      Array.from({ length: count }, (_, index) => `  m${index}: number;`).join('\n');

    it('rejects a function over 60 lines', async () => {
      const source = wrapped('export function f() {', '}', 61);

      expect(only(await ruleIdsFor(source, at('probe.ts')), FUNCTION_RULE)).toHaveLength(1);
    });

    it('rejects five parameters', async () => {
      const source = 'export const f = (a: 1, b: 2, c: 3, d: 4, e: 5) => a;\n';

      expect(only(await ruleIdsFor(source, at('probe.ts')), 'max-params')).toHaveLength(1);
    });

    it('rejects a 301-line file', async () => {
      const ids = await ruleIdsFor(`${statements(301)}\n`, at('probe.ts'));

      expect(only(ids, 'max-lines')).toHaveLength(1);
    });

    it('rejects an interface with 31 members', async () => {
      const source = `export interface I {\n${memberLines(31)}\n}\n`;

      expect(only(await ruleIdsFor(source, at('probe.ts')), 'no-restricted-syntax')).toHaveLength(
        1
      );
    });
  });

  // The matcher in lint/size.js decides which files may hold a long describe callback. It is
  // pinned as it stands: widening it (spec files, tests/ folders) is a ruling, not a quiet edit.
  describe('which files count as test files for the describe exemption', () => {
    const longDescribe = wrapped("describe('x', () => {", '});', 61);
    const exempt = async (file: string) =>
      only(await ruleIdsFor(longDescribe, file), FUNCTION_RULE).length === 0;

    it.each(['ts', 'tsx', 'js', 'mjs', 'cjs', 'mts'])('exempts *.test.%s', async (ext) => {
      expect(await exempt(`client/src/probe.test.${ext}`)).toBe(true);
    });

    it.each([
      'client/src/test/a.ts',
      'server/src/test/a.ts',
      'e2e/test/a.ts',
      'client/src/test/a.tsx',
    ])('exempts a file under a folder named exactly test: %s', async (file) => {
      expect(await exempt(file)).toBe(true);
    });

    it.each([
      'client/src/probe.spec.ts',
      'client/src/probe.spec.tsx',
      'e2e/probe.spec.ts',
      'client/src/tests/a.ts',
      'client/src/__tests__/a.ts',
      'client/src/probe.tests.ts',
      'client/src/test.ts',
      'client/src/probe.test.d.ts',
      'client/src/test.test/a.ts',
      'client/src/atest/a.ts',
    ])('does not exempt %s', async (file) => {
      expect(await exempt(file)).toBe(false);
    });
  });
});
