import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/gutenberg-release-monitor/',
  publicDir: process.env.VITE_TEST_MODE ? 'tests/e2e/public' : 'public',
});
