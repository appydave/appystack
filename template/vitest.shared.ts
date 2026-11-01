import type { CoverageOptions } from 'vitest/node';

/** Coverage settings shared by the client and server vitest configs (one place for the thresholds). */
export const coverage: CoverageOptions = {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  include: ['src/**/*.{ts,tsx}'],
  exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 70,
    statements: 80,
  },
};
