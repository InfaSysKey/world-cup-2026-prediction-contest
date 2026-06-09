import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Plugin de React para transformar JSX/TSX en los tests de componentes.
  plugins: [react()],
  // Resuelve el alias `@/` (CLAUDE.md §4.3) también bajo Vitest; Next ya lo
  // resuelve vía tsconfig.paths, pero Vitest necesita su propia configuración.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    // Entorno por defecto Node; los tests de componentes/hooks fijan jsdom con
    // el docblock `// @vitest-environment jsdom`.
    environment: 'node',
    include: [
      'lib/**/*.test.ts',
      'lib/**/*.test.tsx',
      'components/**/*.test.tsx',
      'app/**/*.test.ts',
      'app/**/*.test.tsx',
    ],
  },
});
