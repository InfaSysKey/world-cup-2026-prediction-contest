/**
 * Estado bloqueado del tab "Podio + Premios" (sub-slice 4.6).
 *
 * Corre SOLO con el project "locked" (npm run e2e:locked): servidor arrancado
 * con TOURNAMENT_START_AT en el pasado, de modo que isAwardsPredictionLocked()
 * devuelve true. Comprobamos:
 *   - El banner global muestra BLOQUEADA.
 *   - Los 3 selects del podio están deshabilitados.
 *
 * El rechazo de la Server Action savePodiumPrediction con LOCKED está cubierto
 * a nivel unitario en app/(porra)/porra/actions.test.ts.
 */
import { expect, test } from '@playwright/test';

import { registerAndLand } from '../fixtures/auth-helpers';

test('palmares locked – banner BLOQUEADA y selects del podio deshabilitados', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('porra-banner')).toContainText('BLOQUEADA');

  await page.getByTestId('porra-tab-palmares').click();
  await expect(page.getByTestId('porra-panel-palmares')).toBeVisible();

  await expect(page.getByTestId('podio-select-champion')).toBeDisabled();
  await expect(page.getByTestId('podio-select-runnerUp')).toBeDisabled();
  await expect(page.getByTestId('podio-select-third')).toBeDisabled();
});
