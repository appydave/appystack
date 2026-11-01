import { fileURLToPath } from 'node:url';
import appyConfig from '@appydave/appystack-config/eslint/react';
import oxlint from 'eslint-plugin-oxlint';
import sonarjs from 'eslint-plugin-sonarjs';
import stylistic from '@stylistic/eslint-plugin';
import { spacingRules } from './lint/spacing.js';
import { sizePlugin, sizeRules } from './lint/size.js';
import { exportsPlugin, exportsRules } from './lint/exports.js';

const COGNITIVE_MAX = 8;
const EXPRESSION_MAX = 3;

// G10: a parent-relative specifier: '..', '../x', './..', './/../x', as a string or a template literal.
// Caught: import / import type, export from, import(), typeof import(), import x = require(),
// require(), and vi.mock / doMock / unmock / doUnmock / importActual / importMock / requireActual /
// requireMock. NOT caught (the gate lints only these forms): import.meta.glob('../x'), a vi that
// has been aliased, a specifier built at run time, and a backslash path ('..\\x', invalid in ESM).
// Filesystem strings such as join(__dirname, '../..') are not specifiers and stay allowed.
const PARENT = String.raw`/^(\.\/+)*\.\.(\/|$)/`;
const MOCKS = 'mock|doMock|unmock|doUnmock|importActual|importMock|requireActual|requireMock';
const PARENT_IMPORT_MESSAGE =
  "No '../' imports: use an alias. Client: @/ @hooks @components @pages @utils @contexts @config. Server: @config/ @helpers/ @routes/ @middleware/ @services/ @test/.";
// no-restricted-syntax has one options array per file: G04's member-count selectors (lint/size.js)
// and G10's must be listed together, or the later block silently replaces the earlier.
const sizeSelectors = sizeRules['no-restricted-syntax'].slice(1);
const parentSpecifier = (node, path) =>
  `${node}:matches([${path}.value=${PARENT}], [${path}.quasis.0.value.cooked=${PARENT}])`;
const parentImportSelectors = [
  parentSpecifier('ImportDeclaration', 'source'),
  parentSpecifier('ExportAllDeclaration', 'source'),
  parentSpecifier('ExportNamedDeclaration', 'source'),
  parentSpecifier('ImportExpression', 'source'),
  parentSpecifier('TSImportType', 'argument.literal'),
  parentSpecifier('TSExternalModuleReference', 'expression'),
  parentSpecifier("CallExpression[callee.name='require']", 'arguments.0'),
  parentSpecifier(
    `CallExpression[callee.object.name='vi'][callee.property.name=/^(${MOCKS})$/]`,
    'arguments.0'
  ),
];

export default [
  ...appyConfig,
  // Inline disable comments are ignored: a gate the code can switch off is not a gate.
  { name: 'quality/no-inline-config', linterOptions: { noInlineConfig: true } },
  {
    name: 'quality/spacing',
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    plugins: { '@stylistic': stylistic },
    rules: spacingRules,
  },
  {
    name: 'quality/size',
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    plugins: { size: sizePlugin },
    rules: sizeRules,
  },
  // G05 magic numbers. Tests are out of scope. Object properties and default parameters are not
  // checked (detectObjects false, ignoreDefaultValues true): the gate does not catch them.
  // Oxlint also has no-magic-numbers; it is off in .oxlintrc.json (oxlintAllowlist.test.ts pins
  // that), so ESLint is the sole owner.
  {
    name: 'quality/magic-numbers',
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    ignores: ['**/*.test.*', '**/test/**'],
    rules: {
      'no-magic-numbers': [
        'error',
        { ignore: [-1, 0, 1, 2], detectObjects: false, ignoreDefaultValues: true },
      ],
    },
  },
  {
    // The scaffold tools (create-appystack/bin/index.js and scripts/customize.ts) rewrite the exact
    // text `PORT: z.coerce.number().default(5501)`. Naming the number would make them silently no-op.
    name: 'quality/magic-numbers-env-exempt',
    files: ['server/src/config/env.ts'],
    rules: { 'no-magic-numbers': 'off' },
  },
  // G06 complexity. Cyclomatic (max 6) is owned by Oxlint's `complexity` rule in .oxlintrc.json;
  // eslint-plugin-oxlint switches ESLint's copy off. SonarJS owns the two metrics Oxlint lacks.
  // Register the rules by name: never spread sonarjs.configs.recommended (295 rules), and never
  // enable sonarjs/cyclomatic-complexity (a second owner). Tests are out of scope.
  {
    name: 'quality/complexity',
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    ignores: ['**/*.test.*', '**/test/**'],
    plugins: { sonarjs },
    rules: {
      'sonarjs/cognitive-complexity': ['error', COGNITIVE_MAX],
      'sonarjs/expression-complexity': ['error', { max: EXPRESSION_MAX }],
    },
  },
  // G10 root imports. Tests are in scope. The vitest configs import ../vitest.shared.js before any
  // alias exists (Vite loads a config without tsconfig paths), so they are exempt by name.
  {
    name: 'quality/root-imports',
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...sizeSelectors,
        ...parentImportSelectors.map((selector) => ({ selector, message: PARENT_IMPORT_MESSAGE })),
      ],
    },
  },
  {
    name: 'quality/root-imports-config-exempt',
    files: ['client/vitest.config.ts', 'server/vitest.config.ts'],
    rules: { 'no-restricted-syntax': ['error', ...sizeSelectors] },
  },
  // G16 re-exports: a module exports only what it declares (tests included). The package's public
  // entry, shared/src/index.ts, is exempt by name: it is the one barrel the apps import through.
  {
    name: 'quality/no-reexport',
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}'],
    plugins: { exports: exportsPlugin },
    rules: exportsRules,
  },
  {
    name: 'quality/no-reexport-entry-exempt',
    files: ['shared/src/index.ts'],
    rules: { 'exports/no-reexport': 'off' },
  },
  // Last: switch off in ESLint every rule that .oxlintrc.json turns on, so each rule has one owner.
  ...oxlint.buildFromOxlintConfigFile(fileURLToPath(new URL('./.oxlintrc.json', import.meta.url))),
];
