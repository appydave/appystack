import { fileURLToPath } from 'node:url';
import appyConfig from '@appydave/appystack-config/eslint/react';
import oxlint from 'eslint-plugin-oxlint';
import stylistic from '@stylistic/eslint-plugin';
import { spacingRules } from './lint/spacing.js';
import { sizePlugin, sizeRules } from './lint/size.js';

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
  // Last: switch off in ESLint every rule that .oxlintrc.json turns on, so each rule has one owner.
  ...oxlint.buildFromOxlintConfigFile(fileURLToPath(new URL('./.oxlintrc.json', import.meta.url))),
];
