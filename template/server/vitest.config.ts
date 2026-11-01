import { defineConfig } from 'vitest/config';
import { coverage } from '../vitest.shared.js';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    include: ['src/**/*.test.ts'],
    coverage,
  },
});
