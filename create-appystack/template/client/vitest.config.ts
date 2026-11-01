import { defineConfig } from 'vitest/config';
import { coverage } from '../vitest.shared.js';
import react from '@vitejs/plugin-react';
import { alias } from './aliases.js';

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage,
  },
});
