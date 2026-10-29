import { defineConfig } from 'oxlint';

// G02: no type lies. Only the anti-slop type rules run here; ESLint stays the general linter.
// Greenfield: no baseline, every finding fails (npm run oxlint).
export default defineConfig({
  jsPlugins: [{ name: 'anti-slop', specifier: 'oxlint-plugin-anti-slop' }],
  categories: { correctness: 'off' },
  ignorePatterns: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '.claude/**'],
  rules: {
    'anti-slop/no-chained-type-assertions': 'error',
    'anti-slop/no-unknown-parameters': 'error',
    'anti-slop/no-unsafe-dictionary-type': 'error',
    'anti-slop/no-module-mocking': 'error',
    'anti-slop/no-widen-then-assert': 'error',
    'anti-slop/no-unknown-type-aliases': 'error',
    'anti-slop/no-reflect-get': 'error',
    'anti-slop/no-reflect-apply': 'error',
    // Every `as T` / `<T>x` in production code is a finding (`as const` is not). The marker is a string
    // nobody writes, so a comment cannot exempt a cast.
    'anti-slop/require-safety-comment-for-type-assertion': [
      'error',
      { markers: ['no-cast-exemption-exists'] },
    ],
  },
  overrides: [
    {
      // Production code only: tests, e2e and test support are not counted.
      files: ['**/*.test.{ts,tsx,mjs,js}', '**/*.spec.{ts,tsx,mjs,js}', 'e2e/**', '**/test/**'],
      rules: { 'anti-slop/require-safety-comment-for-type-assertion': 'off' },
    },
  ],
});
