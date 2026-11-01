import path from 'node:path';

/** Import aliases shared by vite.config.ts and vitest.config.ts; tsconfig.json `paths` must list the same ones. */
export const alias = {
  '@': path.resolve(__dirname, 'src'),
  '@components': path.resolve(__dirname, 'src/components'),
  '@hooks': path.resolve(__dirname, 'src/hooks'),
  '@pages': path.resolve(__dirname, 'src/pages'),
  '@utils': path.resolve(__dirname, 'src/utils'),
  '@config': path.resolve(__dirname, 'src/config'),
};
