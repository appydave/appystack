import appyConfig from '@appydave/appystack-config/eslint/react';
import oxlint from 'eslint-plugin-oxlint';
import stylistic from '@stylistic/eslint-plugin';
import { spacingRules } from './lint/spacing.js';

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
  // Last: switch off in ESLint every rule that .oxlintrc.json turns on, so each rule has one owner.
  ...oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
];
