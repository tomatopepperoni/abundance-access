import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative assets work at both / and /repository-name/. Navigation uses hashes.
  base: process.env.BASE_PATH || './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules/')) return;
          if (id.includes('/react') || id.includes('/scheduler/')) return 'react';
          if (id.includes('/zod/')) return 'validation';
          if (id.includes('/d3-') || id.includes('/internmap/')) return 'geography';
        },
      },
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'] },
  server: { strictPort: true },
  preview: { strictPort: true },
});
