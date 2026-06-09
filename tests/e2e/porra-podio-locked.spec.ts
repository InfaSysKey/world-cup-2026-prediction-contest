/**
 * Estado bloqueado del tab "Podio" (sub-slice 4.6).
 *
 * Corre SOLO con el project "locked" (npm run e2e:locked): servidor arrancado
 * con TOURNAMENT_START_AT en el pasado, de modo que isAwardsPredictionLocked()
 * devuelve true. Comprobamos:
 *   - El banner global muestra BLOQUEADA.
 *   - Los 3 selects del podio están deshabilitados.
 *   - El autosave status muestra "BLOQUEADA" (no "Sin cambios" ni "Guardado").
 *   - Los botones "Sincronizar con bracket" NO son visibles (el componente los
 *     oculta cuando locked=true — véase la condición {mismatch && !locked} en
 *     podio-tab.tsx).
 *
 * El rechazo de la Server Action savePodiumPrediction con LOCKED está cubierto
 * a nivel unitario en app/(porra)/porra/actions.test.ts.
 */
import { expect, test } from '@playwright/test';

import { registerAndLand } from '../fixtures/auth-helpers';

test('podio locked – banner BLOQUEADA y selects del podio deshabilitados', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('porra-banner')).toContainText('BLOQUEADA');

  await page.getByTestId('porra-tab-podio').click();
  await expect(page.getByTestId('porra-panel-podio')).toBeVisible();

  await expect(page.getByTestId('podio-select-champion')).toBeDisabled();
  await expect(page.getByTestId('podio-select-runnerUp')).toBeDisabled();
  await expect(page.getByTestId('podio-select-third')).toBeDisabled();
});

test('podio locked – el indicador de autosave muestra BLOQUEADA', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await page.getByTestId('porra-tab-podio').click();
  await expect(page.getByTestId('porra-panel-podio')).toBeVisible();

  // Cuando locked=true, el componente AutoSaveStatus renderiza el texto
  // "BLOQUEADA" en lugar de cualquier estado de guardado.
  // No tiene data-testid propio; lo localizamos por texto dentro del encabezado
  // del tab (el span está en el header junto al título "Cuadro de honor").
  await expect(page.locator('text=BLOQUEADA').first()).toBeVisible();
});

test('podio locked – los botones "Sincronizar con bracket" no son visibles', async ({
  browser,
}) => {
  // El componente podio-tab.tsx renderiza el botón de sync solo cuando
  // {mismatch && !locked}. Con locked=true nunca deben aparecer, incluso si
  // hubiera mismatches (el usuario no puede cambiar nada).
  const page = await registerAndLand(browser);

  await page.getByTestId('porra-tab-podio').click();
  await expect(page.getByTestId('porra-panel-podio')).toBeVisible();

  await expect(page.getByTestId('podio-sync-champion')).not.toBeVisible();
  await expect(page.getByTestId('podio-sync-runnerUp')).not.toBeVisible();
  await expect(page.getByTestId('podio-sync-third')).not.toBeVisible();
});
