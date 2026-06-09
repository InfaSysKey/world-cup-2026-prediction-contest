/**
 * Estado bloqueado del tab del bracket (sub-slice 4.5).
 *
 * Corre SOLO con el project "locked" (npm run e2e:locked): servidor con
 * TOURNAMENT_START_AT en el pasado, de modo que isKnockoutLocked() devuelve true.
 * Comprobamos que los botones de elegir ganador están deshabilitados y que el
 * indicador de autosave muestra "BLOQUEADA".
 */
import { expect, test } from '@playwright/test';

import { registerAndLandIdentity } from '../fixtures/auth-helpers';
import { seedStandingsAndThirds } from '../fixtures/standings-helpers';

test('bracket locked – los botones de ganador están deshabilitados', async ({
  browser,
}) => {
  const { page, email } = await registerAndLandIdentity(browser);
  await seedStandingsAndThirds(email);
  await page.reload();

  await expect(page.getByTestId('porra-banner')).toContainText('BLOQUEADA');

  await page.getByTestId('porra-tab-dieciseisavos').click();
  await expect(page.getByTestId('porra-panel-dieciseisavos')).toBeVisible();

  await expect(page.getByTestId('bracket-pick-73-home')).toBeDisabled();
  await expect(page.getByTestId('bracket-pick-73-away')).toBeDisabled();
  await expect(page.locator('text=BLOQUEADA').first()).toBeVisible();
});
