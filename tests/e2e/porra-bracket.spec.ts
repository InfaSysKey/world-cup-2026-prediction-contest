/**
 * Tab del bracket eliminatorio (sub-slice 4.5).
 *
 * El árbol se resuelve desde las predicciones del usuario: 1.º/2.º de cada grupo
 * + 8 mejores terceros para 1/16, y los ganadores predichos para las rondas
 * siguientes. Sembramos standings + terceros en BD (seedStandingsAndThirds) para
 * que los 16 cruces de 1/16 sean resolubles sin rellenar todo por UI.
 *
 * Casos:
 *   BRACKET-1  Pulsar un ganador en 1/16 → autosave "Guardado" → recargar → el
 *              ganador sigue marcado.
 *   BRACKET-2  El ganador de 1/16 aparece como lado en el cruce de 1/8 (cascada).
 *   BRACKET-3  Sin standings: los lados de 1/16 salen "pendiente" y no se pueden
 *              elegir.
 */
import { expect, test } from '@playwright/test';

import { registerAndLandIdentity } from '../fixtures/auth-helpers';
import { seedStandingsAndThirds } from '../fixtures/standings-helpers';
import { waitForFreshSave } from '../fixtures/wait-helpers';

test('bracket-1 – pulsar ganador en 1/16 persiste tras recargar', async ({
  browser,
}) => {
  const { page, email } = await registerAndLandIdentity(browser);
  await seedStandingsAndThirds(email);
  await page.reload();

  await page.getByTestId('porra-tab-dieciseisavos').click();
  await expect(page.getByTestId('porra-panel-dieciseisavos')).toBeVisible();

  // Match 73 (2A vs 2B) es totalmente resoluble con los standings sembrados.
  const home = page.getByTestId('bracket-pick-73-home');
  await expect(home).toBeEnabled();
  await home.click();
  await expect(home).toHaveAttribute('aria-pressed', 'true');

  await waitForFreshSave(page, 'bracket-autosave-status');

  await page.reload();
  await page.getByTestId('porra-tab-dieciseisavos').click();
  await expect(page.getByTestId('bracket-pick-73-home')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('bracket-2 – el ganador de 1/16 aparece como lado en 1/8', async ({
  browser,
}) => {
  const { page, email } = await registerAndLandIdentity(browser);
  await seedStandingsAndThirds(email);
  await page.reload();

  // El cruce 90 de 1/8 es W73 vs W75: necesitamos los ganadores de 73 y 75.
  await page.getByTestId('porra-tab-dieciseisavos').click();
  const homeLabel73 = await page
    .getByTestId('bracket-pick-73-home')
    .textContent();
  await page.getByTestId('bracket-pick-73-home').click();
  await waitForFreshSave(page, 'bracket-autosave-status');
  await page.getByTestId('bracket-pick-75-home').click();
  await waitForFreshSave(page, 'bracket-autosave-status');

  await page.getByTestId('porra-tab-octavos').click();
  await expect(page.getByTestId('porra-panel-octavos')).toBeVisible();
  // El lado home del cruce 90 debe ser ahora el ganador elegido en 73.
  await expect(page.getByTestId('bracket-pick-90-home')).toHaveText(
    (homeLabel73 ?? '').trim(),
  );
});

test('bracket-3 – sin standings, los lados de 1/16 salen pendientes', async ({
  browser,
}) => {
  // Usuario recién registrado, sin standings sembrados.
  const { page } = await registerAndLandIdentity(browser);

  await page.getByTestId('porra-tab-dieciseisavos').click();
  await expect(page.getByTestId('porra-panel-dieciseisavos')).toBeVisible();

  await expect(
    page.getByTestId('bracket-side-pending-73-home'),
  ).toBeVisible();
  await expect(
    page.getByTestId('bracket-side-pending-73-away'),
  ).toBeVisible();
});
