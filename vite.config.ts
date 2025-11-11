import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // This is the correct base path for GitHub Actions
  base: "/ATP-dashboard/", 
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
});