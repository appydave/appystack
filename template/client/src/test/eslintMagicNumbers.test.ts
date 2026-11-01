import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// vitest runs with the client workspace as cwd; eslint.config.js sits one level up, at the template root.
const root = resolve(process.cwd(), '..');
const eslint = new ESLint({ cwd: root });
const RULE = 'no-magic-numbers';

async function magicCount(source: string, file = 'server/src/probe.ts'): Promise<number> {
  const [result] = await eslint.lintText(source, { filePath: resolve(root, file) });

  return (result?.messages ?? []).filter((message) => message.ruleId === RULE).length;
}

const BAD = 'export const f = (n: number) => n * 7919;\n';

describe('G05 magic-number gate, run through the real eslint.config.js', () => {
  it('rejects a bare number in production code', async () => {
    expect(await magicCount(BAD)).toBe(1);
  });

  it.each(['probe.js', 'probe.mjs', 'probe.tsx'])('also checks %s files', async (name) => {
    expect(await magicCount(BAD, `client/src/${name}`)).toBe(1);
  });

  it('allows -1, 0, 1 and 2 and rejects 3', async () => {
    expect(await magicCount('export const f = (n: number) => n * -1 + 0 + 1 + 2;\n')).toBe(0);
    expect(await magicCount('export const f = (n: number) => n + 3;\n')).toBe(1);
  });

  it('allows a number bound to a name', async () => {
    expect(await magicCount('export const TIMEOUT_MS = 10000;\n')).toBe(0);
  });

  it('exempts test files by kind, under any folder', async () => {
    expect(await magicCount(BAD, 'server/src/probe.test.ts')).toBe(0);
    expect(await magicCount(BAD, 'client/src/test/probe.ts')).toBe(0);
  });

  it('exempts server/src/config/env.ts by name and no other file', async () => {
    const source = 'export const port = { value: 1 }.value + Number(process.env.X ?? 5501);\n';

    expect(await magicCount(source, 'server/src/config/env.ts')).toBe(0);
    expect(await magicCount(source, 'server/src/config/other.ts')).toBe(1);
  });

  // Recorded holes: detectObjects false and ignoreDefaultValues true mean the gate does not catch these.
  it('does not flag object properties or default parameters (known holes)', async () => {
    expect(await magicCount('export const limits = { limit: 100 };\n')).toBe(0);
    expect(await magicCount('export function f(code = 200) {\n  return code;\n}\n')).toBe(0);
  });
});
