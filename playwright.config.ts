import { existsSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

// Carga .env para que los tests vean ADMIN_BOOTSTRAP_* (igual que lib/env.ts).
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
