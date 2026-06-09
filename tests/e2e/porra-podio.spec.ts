/**
 * Cobertura e2e del tab "Podio" (sub-slice 4.6). Los premios individuales
 * tienen su propio tab desde 4.7 (porra-premios.spec.ts).
 *
 * Un usuario recién registrado no tiene predicción de bracket (el tab de
 * eliminatorias aún no existe), así que la deducción es vacía: los 3 selects
 * arrancan vacíos y las líneas de ayuda dicen "Necesitas predecir …". Eso
 * basta para cubrir el flujo del formulario:
 *   1. Los 3 selects y sus líneas de ayuda (sin deducción) se renderizan.
 *   2. Elegir un campeón → autosave "Guardado" → recarga → persiste.
 *   3. Rellenar los 3 puestos distintos → indicador del stepper "completo".
 *   4. Repetir equipo en dos puestos → error de distinción visible.
 *
 * La deducción desde el bracket y los avisos de sincronización se cubren a nivel
 * unitario (deduce-podium.test.ts, cross-tab.test.ts). El estado bloqueado vive
 * en porra-podio-locked.spec.ts (project=locked).
 */
import { expect, test } from '@playwright/test';

import { registerAndLand } from '../fixtures/auth-helpers';
import { gotoPodio, pickPodio, podioTeamCodes } from '../fixtures/podio-helpers';

test('podio – los 3 selects y las ayudas sin deducción se renderizan', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);
  await gotoPodio(page);

  await expect(page.getByTestId('podio-select-champion')).toBeVisible();
  await expect(page.getByTestId('podio-select-runnerUp')).toBeVisible();
  await expect(page.getByTestId('podio-select-third')).toBeVisible();

  await expect(page.getByTestId('podio-hint-champion')).toContainText(
    'Necesitas predecir la final para deducir el campeón',
  );
  await expect(page.getByTestId('podio-hint-runnerUp')).toContainText(
    'Necesitas predecir las 2 semifinales y la final para deducir el subcampeón',
  );
  await expect(page.getByTestId('podio-hint-third')).toContainText(
    'Necesitas predecir el partido por el 3.º puesto para deducir el 3.º',
  );
});

test('podio – elegir un campeón persiste tras recarga', async ({ browser }) => {
  const page = await registerAndLand(browser);
  await gotoPodio(page);

  const [c0] = await podioTeamCodes(page, 3);
  await pickPodio(page, 'champion', c0);

  await page.reload();
  await gotoPodio(page);
  await expect(page.getByTestId('podio-select-champion')).toHaveValue(c0);
});

test('podio – rellenar los 3 puestos marca el tab como completo', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);
  await gotoPodio(page);

  const [c0, c1, c2] = await podioTeamCodes(page, 3);
  await pickPodio(page, 'champion', c0);
  await pickPodio(page, 'runnerUp', c1);
  await pickPodio(page, 'third', c2);

  await page.reload();
  await expect(page.getByTestId('porra-tab-mark-podio')).toHaveAttribute(
    'aria-label',
    'completo',
  );

  await gotoPodio(page);
  await expect(page.getByTestId('podio-select-champion')).toHaveValue(c0);
  await expect(page.getByTestId('podio-select-runnerUp')).toHaveValue(c1);
  await expect(page.getByTestId('podio-select-third')).toHaveValue(c2);
});

test('podio – repetir equipo en dos puestos muestra el error de distinción', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);
  await gotoPodio(page);

  const [c0] = await podioTeamCodes(page, 3);
  await pickPodio(page, 'champion', c0);

  // Mismo equipo en subcampeón → duplicado, no se guarda y aparece el error.
  await page.getByTestId('podio-select-runnerUp').selectOption(c0);
  await expect(page.getByTestId('podio-duplicates-error')).toBeVisible();
  await expect(page.getByTestId('podio-duplicates-error')).toContainText(
    'Cada posición del podio debe ser un equipo diferente',
  );
});

test('podio – los valores persisten al cambiar de tab y volver', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);
  await gotoPodio(page);

  // Elegir campeón y esperar autosave.
  const [c0] = await podioTeamCodes(page, 3);
  await pickPodio(page, 'champion', c0);

  // Navegar a otro tab (Grupos).
  await page.getByTestId('porra-tab-grupos').click();
  await expect(page.getByTestId('porra-panel-grupos')).toBeVisible();

  // Volver al tab Podio.
  await page.getByTestId('porra-tab-podio').click();
  await expect(page.getByTestId('podio-tab')).toBeVisible();

  // El select sigue mostrando el equipo elegido (React mantiene el estado
  // en memoria y la BD ya lo tiene por el autosave).
  await expect(page.getByTestId('podio-select-champion')).toHaveValue(c0);
});
