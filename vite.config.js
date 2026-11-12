import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    open: false,
    // Same-origin API calls in development: the browser talks to Vite, Vite forwards /api to the
    // backend. No CORS round-trips, and the httpOnly refresh cookie works as-is.
    proxy: { '/api': { target: process.env.VITE_API_PROXY || 'http://localhost:4000', changeOrigin: true } },
  },
  preview: {
    proxy: { '/api': { target: process.env.VITE_API_PROXY || 'http://localhost:4000', changeOrigin: true } },
  },
});
