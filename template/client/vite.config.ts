import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// TODO: Update port and proxy target for your project
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, 'src/components'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },
  server: {
    port: 5500,
    proxy: {
      '/api': {
        target: 'http://localhost:5501',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5501',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5501',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
