import { existsSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

// Carga .env para que los tests vean ADMIN_BOOTSTRAP_* (igual que lib/env.ts).
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Playwright arranca SIEMPRE todos los webServer del array y corre todos los
// projects salvo que se filtre con --project. Arrancar a la vez el servidor
// "abierto" (3000) y el "bloqueado" (3001), más el global-setup, satura el
// runner y hace que el registro expire bajo carga. Por eso seleccionamos UN
// solo modo por ejecución con la env var PW_LOCKED:
//   - `npm run e2e`        → modo abierto: project chromium contra el server 3000.
//   - `npm run e2e:locked` → modo bloqueado: project locked contra el server 3001.
//   - `npm run e2e:all`    → encadena ambos en secuencia (nunca a la vez).
const RUN_LOCKED = !!process.env.PW_LOCKED;

// Servidor con predicciones BLOQUEADAS (TOURNAMENT_START_AT en el pasado).
const LOCKED_PORT = 3001;
const LOCKED_BASE_URL = `http://localhost:${LOCKED_PORT}`;
const LOCKED_START_AT = '2020-01-01T00:00:00Z';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  use: {
    baseURL: RUN_LOCKED ? LOCKED_BASE_URL : 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: RUN_LOCKED
    ? [
        {
          command: `PORT=${LOCKED_PORT} npm run dev`,
          url: LOCKED_BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            TOURNAMENT_START_AT: LOCKED_START_AT,
            PORT: String(LOCKED_PORT),
          },
        },
      ]
    : [
        {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
  projects: RUN_LOCKED
    ? [
        {
          // Toda la porra está bloqueada porque TOURNAMENT_START_AT es 2020-01-01.
          name: 'locked',
          use: { ...devices['Desktop Chrome'], baseURL: LOCKED_BASE_URL },
          testMatch: ['**/porra-grupos-locked.spec.ts'],
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
          // Los tests del modo bloqueado se corren solo con PW_LOCKED=1.
          testIgnore: ['**/porra-grupos-locked.spec.ts'],
        },
      ],
});
