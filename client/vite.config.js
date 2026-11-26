import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The API runs on :5000. Proxying keeps everything on one origin, so the
    // session cookie can stay SameSite=Strict and no CORS is needed.
    proxy: { '/api': 'http://localhost:5000' },
  },
});
