import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    conditions: ['browser'],
  },
});
