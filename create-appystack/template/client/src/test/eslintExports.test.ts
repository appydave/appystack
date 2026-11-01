// @vitest-environment node
// eslint.config.js builds file URLs, which jsdom's URL cannot do.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// vitest runs with the client workspace as cwd; eslint.config.js sits one level up, at the template root.
const root = resolve(process.cwd(), '..');
const eslint = new ESLint({ cwd: root });
const ERROR_SEVERITY = 2;
const WHOLE_TREE_TIMEOUT_MS = 120_000;

async function reexports(source: string, file = 'server/src/probe.ts'): Promise<number> {
  const [result] = await eslint.lintText(source, { filePath: resolve(root, file) });

  return (result?.messages ?? []).filter(
    (message) => message.ruleId === 'exports/no-reexport' && message.severity === ERROR_SEVERITY
  ).length;
}

const FORMS = {
  'export all': "export * from './a.js';\n",
  'export all as': "export * as ns from './a.js';\n",
  'export named from': "export { a } from './a.js';\n",
  'export type from': "export type { A } from './a.js';\n",
  'export as default from': "export { a as default } from './a.js';\n",
  'import then export': "import { a } from './a.js';\nexport { a };\n",
  'import type then export type': "import type { A } from './a.js';\nexport type { A };\n",
  'import namespace then export': "import * as ns from './a.js';\nexport { ns };\n",
  'import renamed then export renamed': "import { a as b } from './a.js';\nexport { b as c };\n",
  'import then export default': "import a from './a.js';\nexport default a;\n",
  'import = then export =': "import a = require('./a.js');\nexport = a;\n",
};

// The first group is allowed on purpose; the last is NOT caught (named in lint/exports.js): a recorded hole.
const ALLOWED = {
  'a local export list': 'const a = 1;\nexport { a };\n',
  'an exported declaration': 'export const a = 1;\nexport function f() {}\n',
  'an exported type': 'export type A = string;\nexport interface B {}\n',
  'an import that is only used': "import { a } from './a.js';\nexport const b = a + 1;\n",
  'a default export of a local': 'const a = 1;\nexport default a;\n',
  'a default export of a call': "import { a } from './a.js';\nexport default a();\n",
  'a local that shadows an import name':
    "import { a } from './a.js';\nexport const f = (a: number) => a;\n",
  'a copy through a variable (known hole)':
    "import { a } from './a.js';\nconst b = a;\nexport { b };\n",
};

const BARREL = "export * from './a.js';\n";
const LOOKALIKES = [
  'shared/src/other/index.ts',
  'shared/src/sub/dir/index.ts',
  'client/src/index.ts',
  'client/shared/src/index.ts',
  'server/src/shared/src/index.ts',
  'shared/index.ts',
  'shared/src/index.tsx',
];

describe('G16 no-reexport gate, run through the real eslint.config.js', () => {
  it.each(Object.entries(FORMS))('rejects %s', async (_name, source) => {
    expect(await reexports(source)).toBe(1);
  });

  it.each(Object.entries(ALLOWED))('allows %s', async (_name, source) => {
    expect(await reexports(source)).toBe(0);
  });

  it.each([
    ['a test file', 'client/src/probe.test.ts'],
    ['a script', 'scripts/probe.mjs'],
    ['an e2e file', 'e2e/probe.ts'],
    ['a config file', 'probe.config.cjs'],
  ])('also lints %s', async (_name, file) => {
    expect(await reexports(BARREL, file)).toBe(1);
  });

  it('still reports when a disable comment is written above it', async () => {
    const directive = ['eslint', 'disable-next-line exports/no-reexport'].join('-');

    expect(await reexports(`// ${directive}\n${BARREL}`)).toBe(1);
  });

  it('exempts the package entry and not its look-alikes', async () => {
    expect(await reexports(BARREL, 'shared/src/index.ts')).toBe(0);
    for (const file of LOOKALIKES) {
      expect(await reexports(BARREL, file), file).toBe(1);
    }
  });

  // Both blocks are pinned whole, by literal: dropping a file type, widening the exemption, or turning
  // the rule to warn is red. The plugin object is checked by identity against lint/exports.js.
  it('is exactly the two reviewed config blocks', async () => {
    const { default: config } = await import(pathToFileURL(resolve(root, 'eslint.config.js')).href);
    const { exportsPlugin } = await import(pathToFileURL(resolve(root, 'lint/exports.js')).href);
    const byName = (name: string) => config.find((entry: { name?: string }) => entry.name === name);

    expect(byName('quality/no-reexport')).toEqual({
      name: 'quality/no-reexport',
      files: ['**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}'],
      plugins: { exports: exportsPlugin },
      rules: { 'exports/no-reexport': 'error' },
    });
    expect(byName('quality/no-reexport-entry-exempt')).toEqual({
      name: 'quality/no-reexport-entry-exempt',
      files: ['shared/src/index.ts'],
      rules: { 'exports/no-reexport': 'off' },
    });
  });

  it(
    'finds nothing in the real tree',
    async () => {
      const results = await eslint.lintFiles(['.']);
      const found = results.flatMap((result) =>
        result.messages
          .filter((message) => message.ruleId === 'exports/no-reexport')
          .map((message) => `${result.filePath}:${message.line}`)
      );

      expect(found).toEqual([]);
    },
    WHOLE_TREE_TIMEOUT_MS
  );
});
