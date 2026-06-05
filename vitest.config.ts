import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resuelve el alias `@/` (CLAUDE.md §4.3) también bajo Vitest; Next ya lo
  // resuelve vía tsconfig.paths, pero Vitest necesita su propia configuración.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
