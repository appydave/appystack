import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// vitest runs with the client workspace as cwd; eslint.config.js sits one level up, at the template root.
const root = resolve(process.cwd(), '..');
const eslint = new ESLint({ cwd: root });

async function ruleIdsFor(source: string, file = 'client/src/probe.ts'): Promise<string[]> {
  const [result] = await eslint.lintText(source, { filePath: resolve(root, file) });

  return (result?.messages ?? []).map((message) => message.ruleId ?? 'parse-error');
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
      ["describe('x', function () {", '});'],
    ])('allows a 61-line %s callback', async (opener, closer) => {
      const ids = await ruleIdsFor(wrapped(opener, closer, 61), TEST_FILE);

      expect(only(ids, FUNCTION_RULE)).toHaveLength(0);
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
});
