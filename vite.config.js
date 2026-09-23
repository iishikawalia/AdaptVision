import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser only ever talks to our Express server; the API key never ships to it.
export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    host: true, // so tablets on the same Wi-Fi can open the dev server too
    proxy: { '/api': 'http://localhost:8787' },
  },
});
