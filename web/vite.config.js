import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend talks to the backend through /api (proxied to the Express server).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
