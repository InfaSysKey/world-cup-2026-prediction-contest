/**
 * Estado bloqueado del tab "Premios" (sub-slice 4.7).
 *
 * Corre SOLO con el project "locked" (npm run e2e:locked): servidor arrancado
 * con TOURNAMENT_START_AT en el pasado, de modo que isAwardsPredictionLocked()
 * devuelve true. Comprobamos:
 *   - El banner global muestra BLOQUEADA.
 *   - Los 6 inputs de premios están deshabilitados.
 *   - El indicador de autosave muestra "BLOQUEADA".
 */
import { expect, test } from '@playwright/test';

import { registerAndLand } from '../fixtures/auth-helpers';

const KEYS = [
  'bootGold',
  'bootSilver',
  'bootBronze',
  'ballGold',
  'ballSilver',
  'ballBronze',
];

test('premios locked – banner BLOQUEADA y los 6 inputs deshabilitados', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('porra-banner')).toContainText('BLOQUEADA');

  await page.getByTestId('porra-tab-premios').click();
  await expect(page.getByTestId('porra-panel-premios')).toBeVisible();

  for (const key of KEYS) {
    await expect(page.getByTestId(`premios-input-${key}`)).toBeDisabled();
  }
});

test('premios locked – el indicador de autosave muestra BLOQUEADA', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await page.getByTestId('porra-tab-premios').click();
  await expect(page.getByTestId('porra-panel-premios')).toBeVisible();

  // Con locked=true, AutoSaveStatus renderiza "BLOQUEADA" (sin data-testid
  // propio) en lugar de cualquier estado de guardado.
  await expect(page.locator('text=BLOQUEADA').first()).toBeVisible();
});
