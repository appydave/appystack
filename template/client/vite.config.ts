import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// TODO: Update port and proxy target for your project
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
