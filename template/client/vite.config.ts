import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { alias } from './aliases.js';

// TODO: Update port and proxy target for your project
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias },
  server: {
    port: 5500,
    strictPort: true,
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
