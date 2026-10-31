import appyConfig from '@appydave/appystack-config/eslint/react';
import stylistic from '@stylistic/eslint-plugin';
import { spacingRules } from './lint/spacing.js';

export default [
  ...appyConfig,
  {
    name: 'quality/spacing',
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    plugins: { '@stylistic': stylistic },
    rules: spacingRules,
  },
];
