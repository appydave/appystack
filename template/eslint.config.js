import { fileURLToPath } from 'node:url';
import appyConfig from '@appydave/appystack-config/eslint/react';
import oxlint from 'eslint-plugin-oxlint';
import sonarjs from 'eslint-plugin-sonarjs';
import stylistic from '@stylistic/eslint-plugin';
import { spacingRules } from './lint/spacing.js';
import { sizePlugin, sizeRules } from './lint/size.js';

const COGNITIVE_MAX = 8;
const EXPRESSION_MAX = 3;

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
  // Last: switch off in ESLint every rule that .oxlintrc.json turns on, so each rule has one owner.
  ...oxlint.buildFromOxlintConfigFile(fileURLToPath(new URL('./.oxlintrc.json', import.meta.url))),
];
