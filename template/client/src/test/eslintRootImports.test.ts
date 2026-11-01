import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// vitest runs with the client workspace as cwd; eslint.config.js sits one level up, at the template root.
const root = resolve(process.cwd(), '..');
const eslint = new ESLint({ cwd: root });
const ERROR_SEVERITY = 2;

// Only G10's messages: the same rule also carries G04's member-count selectors.
async function parentImports(source: string, file = 'server/src/probe.ts'): Promise<number> {
  const [result] = await eslint.lintText(source, { filePath: resolve(root, file) });

  return (result?.messages ?? []).filter(
    (message) =>
      message.ruleId === 'no-restricted-syntax' &&
      message.severity === ERROR_SEVERITY &&
      message.message.includes('use an alias')
  ).length;
}

const FORMS = {
  'static import': "import { a } from '../a.js';\nexport const b = a;\n",
  'import type': "import type { A } from '../../a.js';\nexport type B = A;\n",
  'bare ..': "import * as up from '..';\nexport const b = up;\n",
  'export all': "export * from '../a.js';\n",
  'export named': "export { a } from '../a.js';\n",
  'dynamic import()': "export const load = () => import('../a.js');\n",
  'vi.mock': "vi.mock('../a.js', () => ({}));\n",
  'vi.doMock': "vi.doMock('../a.js', () => ({}));\n",
  'vi.importActual': "export const real = () => vi.importActual('../a.js');\n",
  'vi.importMock': "export const real = () => vi.importMock('../a.js');\n",
};

const ALLOWED = {
  'an alias import': "import { a } from '@config/a.js';\nexport const b = a;\n",
  'a sibling import': "import { a } from './a.js';\nexport const b = a;\n",
  'a filesystem path': "export const dist = join(__dirname, '../../client/dist');\n",
  'a sibling vi.doMock': "vi.doMock('./a.js', () => ({}));\n",
  'another object mock': "other.mock('../a.js');\n",
};

describe('G10 root-imports gate, run through the real eslint.config.js', () => {
  it.each(Object.entries(FORMS))('rejects %s', async (_name, source) => {
    expect(await parentImports(source)).toBe(1);
  });

  it.each(Object.entries(ALLOWED))('allows %s', async (_name, source) => {
    expect(await parentImports(source)).toBe(0);
  });

  it('checks tests and client code too', async () => {
    expect(await parentImports(FORMS['static import'], 'server/src/probe.test.ts')).toBe(1);
    expect(await parentImports(FORMS['static import'], 'client/src/test/probe.ts')).toBe(1);
    expect(await parentImports(FORMS['static import'], 'client/src/probe.tsx')).toBe(1);
  });

  it('still reports when a disable comment is written above it', async () => {
    const directive = ['eslint', 'disable-next-line no-restricted-syntax'].join('-');

    expect(await parentImports(`// ${directive}\n${FORMS['static import']}`)).toBe(1);
  });

  it('exempts the two vitest configs by name and no sibling', async () => {
    const source = "import { coverage } from '../vitest.shared.js';\nexport default coverage;\n";

    expect(await parentImports(source, 'client/vitest.config.ts')).toBe(0);
    expect(await parentImports(source, 'server/vitest.config.ts')).toBe(0);
    expect(await parentImports(source, 'client/src/vitest.config.ts')).toBe(1);
    expect(await parentImports(source, 'server/src/vitest.config.ts')).toBe(1);
    expect(await parentImports(source, 'e2e/vitest.config.ts')).toBe(1);
  });

  // Pins the whole selector list, so dropping or loosening one is red. Three size selectors (G04) come first.
  it('is exactly the reviewed selector list, at error severity', async () => {
    const config = await eslint.calculateConfigForFile(resolve(root, 'server/src/probe.ts'));
    const [severity, ...options] = config.rules?.['no-restricted-syntax'] ?? [];
    const selectors = options.map((option: { selector: string }) => option.selector).slice(3);

    expect(severity).toBe(ERROR_SEVERITY);
    expect(selectors).toEqual([
      String.raw`ImportDeclaration[source.value=/^\.\.(\/|$)/]`,
      String.raw`ExportAllDeclaration[source.value=/^\.\.(\/|$)/]`,
      String.raw`ExportNamedDeclaration[source.value=/^\.\.(\/|$)/]`,
      String.raw`ImportExpression[source.value=/^\.\.(\/|$)/]`,
      String.raw`CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock|importActual|importMock)$/][arguments.0.value=/^\.\.(\/|$)/]`,
    ]);
  });
});
