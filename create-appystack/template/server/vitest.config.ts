import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { coverage } from '../vitest.shared.js';

// Vitest does not read tsconfig `paths`: keep these in step with server/tsconfig.json.
const alias = {
  '@config': path.resolve(__dirname, 'src/config'),
  '@helpers': path.resolve(__dirname, 'src/helpers'),
  '@test': path.resolve(__dirname, 'src/test'),
};

export default defineConfig({
  resolve: { alias },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    include: ['src/**/*.test.ts'],
    coverage,
  },
});
