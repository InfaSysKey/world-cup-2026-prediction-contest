/**
 * Tab "Podio": comportamiento sin bracket previo (sub-slice 4.6).
 *
 * Tras eliminar el prefill que escribía en BD (ADR 0005, CRÍTICO 2 del informe
 * ultracode), el podio se SUGIERE desde el bracket pero no se persiste solo. Un
 * usuario recién registrado no tiene bracket, así que no hay sugerencia: los 3
 * selects arrancan vacíos y los hints indican qué falta predecir.
 *
 * El flujo "con bracket → sugerencia pendiente que se confirma o edita" se cubre
 * a nivel unitario en lib/scoring/porra-summary.test.ts (estados
 * persisted/suggested) y, e2e, en el segundo test de este archivo (sembrando la
 * final con seedKnockoutWinner).
 */
import { expect, test } from '@playwright/test';

import {
  registerAndLand,
  registerAndLandIdentity,
} from '../fixtures/auth-helpers';
import { seedKnockoutWinner } from '../fixtures/knockout-helpers';
import { gotoPodio, podioTeamCodes } from '../fixtures/podio-helpers';
import { waitForFreshSave } from '../fixtures/wait-helpers';

test('podio sin bracket – los 3 selects arrancan vacíos y los hints lo indican', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await page.getByTestId('porra-tab-podio').click();
  await expect(page.getByTestId('porra-panel-podio')).toBeVisible();
  await expect(page.getByTestId('podio-tab')).toBeVisible();

  // Los selects no tienen valor seleccionado (valor vacío = placeholder).
  await expect(page.getByTestId('podio-select-champion')).toHaveValue('');
  await expect(page.getByTestId('podio-select-runnerUp')).toHaveValue('');
  await expect(page.getByTestId('podio-select-third')).toHaveValue('');

  // Los hints informan QUÉ falta predecir en el bracket para derivar cada puesto.
  await expect(page.getByTestId('podio-hint-champion')).toContainText(
    'Necesitas predecir la final para deducir el campeón',
  );
  await expect(page.getByTestId('podio-hint-runnerUp')).toContainText(
    'Necesitas predecir las 2 semifinales y la final para deducir el subcampeón',
  );
  await expect(page.getByTestId('podio-hint-third')).toContainText(
    'Necesitas predecir el partido por el 3.º puesto para deducir el 3.º',
  );

  // Sin bracket no hay deducción → no aparece ningún aviso "Sugerido por tu
  // bracket" (la sugerencia pendiente solo existe cuando hay deducción).
  await expect(page.getByTestId('podio-suggested-champion')).not.toBeVisible();
  await expect(page.getByTestId('podio-suggested-runnerUp')).not.toBeVisible();
  await expect(page.getByTestId('podio-suggested-third')).not.toBeVisible();
});

test('podio con bracket – el campeón aparece sugerido (pendiente) y se persiste al confirmar', async ({
  browser,
}) => {
  const { page, email } = await registerAndLandIdentity(browser);

  // Leer un code válido para sembrar el ganador de la final.
  await gotoPodio(page);
  const [d] = await podioTeamCodes(page, 1);
  await seedKnockoutWinner(email, 'final', d);
  await page.reload();
  await gotoPodio(page);

  // El select del campeón muestra el valor sugerido y aparece el aviso pendiente.
  await expect(page.getByTestId('podio-select-champion')).toHaveValue(d);
  await expect(page.getByTestId('podio-suggested-champion')).toBeVisible();

  // Sin confirmar, el indicador del tab está en "revisar": no es hueco, pero la
  // sugerencia no se ha confirmado (no se persiste sola, ADR 0005).
  await expect(page.getByTestId('porra-tab-mark-podio')).toHaveAttribute(
    'aria-label',
    'revisar',
  );

  // Confirmar persiste el valor y quita el estado pendiente.
  await page.getByTestId('podio-confirm-champion').click();
  await waitForFreshSave(page, 'podio-autosave-status');
  await page.reload();
  await gotoPodio(page);

  await expect(page.getByTestId('podio-select-champion')).toHaveValue(d);
  await expect(page.getByTestId('podio-suggested-champion')).not.toBeVisible();
});
