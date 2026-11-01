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
  './..': "import * as up from './..';\nexport const b = up;\n",
  './/../': "import { a } from './/../a.js';\nexport const b = a;\n",
  'export all': "export * from '../a.js';\n",
  'export named': "export { a } from '../a.js';\n",
  'dynamic import()': "export const load = () => import('../a.js');\n",
  'template import()': 'export const load = () => import(`../a.js`);\n',
  'typeof import()': "export type T = typeof import('../a.js');\n",
  'import = require': "import a = require('../a.js');\nexport { a };\n",
  require: "export const a = require('../a.js');\n",
  'vi.mock': "vi.mock('../a.js', () => ({}));\n",
  'vi.mock template': 'vi.mock(`../a.js`, () => ({}));\n',
  'vi.doMock': "vi.doMock('../a.js', () => ({}));\n",
  'vi.unmock': "vi.unmock('../a.js');\n",
  'vi.doUnmock': "vi.doUnmock('../a.js');\n",
  'vi.importActual': "export const real = () => vi.importActual('../a.js');\n",
  'vi.importMock': "export const real = () => vi.importMock('../a.js');\n",
  'vi.requireActual': "export const real = () => vi.requireActual('../a.js');\n",
  'vi.requireMock': "export const real = () => vi.requireMock('../a.js');\n",
};

// The first group is allowed on purpose; the second is NOT caught (named in eslint.config.js): a recorded hole.
const ALLOWED = {
  'an alias import': "import { a } from '@config/a.js';\nexport const b = a;\n",
  'a sibling import': "import { a } from './a.js';\nexport const b = a;\n",
  'a filesystem path': "export const dist = join(__dirname, '../../client/dist');\n",
  'a sibling vi.doMock': "vi.doMock('./a.js', () => ({}));\n",
  'another object mock': "other.mock('../a.js');\n",
  'import.meta.glob (known hole)': "export const all = import.meta.glob('../*.ts');\n",
  'an aliased vi (known hole)': "const v = vi;\nv.mock('../a.js');\n",
  'a backslash path (known hole)': "import { a } from '..\\\\a.js';\nexport const b = a;\n",
};

describe('G10 root-imports gate, run through the real eslint.config.js', () => {
  it.each(Object.entries(FORMS))('rejects %s', async (_name, source) => {
    expect(await parentImports(source)).toBe(1);
  });

  it.each(Object.entries(ALLOWED))('allows %s', async (_name, source) => {
    expect(await parentImports(source)).toBe(0);
  });

  it('still reports when a disable comment is written above it', async () => {
    const directive = ['eslint', 'disable-next-line no-restricted-syntax'].join('-');

    expect(await parentImports(`// ${directive}\n${FORMS['static import']}`)).toBe(1);
  });

  // Both blocks are pinned whole, by literal: dropping a folder, a file type or a selector, or widening
  // the exemption, is red. G04's three size selectors are taken from lint/size.js (one options array per file).
  it('is exactly the two reviewed config blocks', async () => {
    const { default: config } = await import(pathToFileURL(resolve(root, 'eslint.config.js')).href);
    const { sizeRules } = await import(pathToFileURL(resolve(root, 'lint/size.js')).href);
    const byName = (name: string) => config.find((entry: { name?: string }) => entry.name === name);
    const size: unknown[] = sizeRules['no-restricted-syntax'].slice(1);
    const re = String.raw`/^(\.\/+)*\.\.(\/|$)/`;
    const matches = (node: string, path: string) =>
      `${node}:matches([${path}.value=${re}], [${path}.quasis.0.value.cooked=${re}])`;
    const message =
      "No '../' imports: use an alias. Client: @/ @hooks @components @pages @utils @contexts @config. Server: @config/ @helpers/ @routes/ @middleware/ @services/ @test/.";
    const mocks = 'mock|doMock|unmock|doUnmock|importActual|importMock|requireActual|requireMock';
    const selectors = [
      matches('ImportDeclaration', 'source'),
      matches('ExportAllDeclaration', 'source'),
      matches('ExportNamedDeclaration', 'source'),
      matches('ImportExpression', 'source'),
      matches('TSImportType', 'argument.literal'),
      matches('TSExternalModuleReference', 'expression'),
      matches("CallExpression[callee.name='require']", 'arguments.0'),
      matches(
        `CallExpression[callee.object.name='vi'][callee.property.name=/^(${mocks})$/]`,
        'arguments.0'
      ),
    ];

    expect(byName('quality/root-imports')).toEqual({
      name: 'quality/root-imports',
      files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
      rules: {
        'no-restricted-syntax': [
          'error',
          ...size,
          ...selectors.map((selector) => ({ selector, message })),
        ],
      },
    });
    expect(byName('quality/root-imports-config-exempt')).toEqual({
      name: 'quality/root-imports-config-exempt',
      files: ['client/vitest.config.ts', 'server/vitest.config.ts'],
      rules: { 'no-restricted-syntax': ['error', ...size] },
    });
  });

  it('exempts a vitest config and not its look-alikes', async () => {
    const source = "import { coverage } from '../vitest.shared.js';\nexport default coverage;\n";

    expect(await parentImports(source, 'server/vitest.config.ts')).toBe(0);
    expect(await parentImports(source, 'server/src/vitest.config.ts')).toBe(1);
  });
});
