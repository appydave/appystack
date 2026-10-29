// Tests, e2e and test support: not production code. Shared by every gate that treats tests differently.
export const testFiles = [
  '**/*.test.{ts,tsx,mjs,js}',
  '**/*.spec.{ts,tsx,mjs,js}',
  'e2e/**',
  '**/test/**',
];
