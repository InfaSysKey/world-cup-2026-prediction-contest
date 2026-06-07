/**
 * Test 8 de la cobertura del tab "Mejores Terceros" (sub-slice 4.4): estado
 * bloqueado.
 *
 * Este archivo SOLO corre con el project "locked" (npm run e2e:locked), que
 * apunta a un servidor Next.js arrancado con TOURNAMENT_START_AT=2020-01-01
 * (en el pasado), de modo que isBestThirdsLocked() devuelve true.
 *
 * En el servidor bloqueado un usuario nuevo tampoco puede rellenar los standings
 * (también bloqueados), así que no tiene ningún 3.º predicho y el tab Mejores
 * Terceros solo puede mostrar el EMPTY STATE: la UI de drag-and-drop no es
 * alcanzable sin candidatos. Por eso aquí cubrimos:
 *   - El banner global muestra BLOQUEADA.
 *   - El tab Mejores Terceros renderiza su empty state.
 *
 * La protección de escritura del tab (Server Action saveBestThirdsPrediction
 * rechaza con LOCKED) está cubierta a nivel unitario en
 * app/(porra)/porra/actions.test.ts.
 */
import { expect, test } from '@playwright/test';

import { registerAndLand } from '../fixtures/auth-helpers';

test('mejores-terceros locked – banner BLOQUEADA y tab muestra el empty state (sin standings)', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('porra-banner')).toContainText('BLOQUEADA');

  await page.getByTestId('porra-tab-mejores-terceros').click();
  await expect(page.getByTestId('porra-panel-mejores-terceros')).toBeVisible();
  await expect(page.getByTestId('bt-empty-state')).toBeVisible();
});
