/**
 * Cobertura e2e del tab "Premios" — botas y balones (sub-slice 4.7).
 *
 * El tab más simple del formulario: 6 inputs de texto libre, sin deducción ni
 * stale. Cubrimos:
 *   1. Los 6 inputs y sus hints se renderizan.
 *   2. Escribir un nombre → autosave "Guardado" → recarga → persiste.
 *   3. Rellenar los 6 → indicador del stepper "completo".
 *   4. Repetir jugador en dos botas → error de distinción visible.
 *   5. Mismo jugador en bota Y balón → permitido (no cruza grupos).
 *
 * El estado bloqueado vive en porra-premios-locked.spec.ts (project=locked) y el
 * rechazo de la Server Action con LOCKED se cubre en actions.test.ts.
 */
import { expect, test } from '@playwright/test';

import { registerAndLand } from '../fixtures/auth-helpers';
import { fillPremio, gotoPremios } from '../fixtures/premios-helpers';

test('premios – los 6 inputs y sus hints se renderizan', async ({ browser }) => {
  const page = await registerAndLand(browser);
  await gotoPremios(page);

  for (const key of [
    'bootGold',
    'bootSilver',
    'bootBronze',
    'ballGold',
    'ballSilver',
    'ballBronze',
  ]) {
    await expect(page.getByTestId(`premios-input-${key}`)).toBeVisible();
  }
});

test('premios – escribir un nombre persiste tras recarga', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);
  await gotoPremios(page);

  await fillPremio(page, 'bootGold', 'Mbappé');

  await page.reload();
  await gotoPremios(page);
  await expect(page.getByTestId('premios-input-bootGold')).toHaveValue('Mbappé');
});

test('premios – rellenar los 6 marca el tab como completo', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);
  await gotoPremios(page);

  await fillPremio(page, 'bootGold', 'Mbappé');
  await fillPremio(page, 'bootSilver', 'Haaland');
  await fillPremio(page, 'bootBronze', 'Kane');
  await fillPremio(page, 'ballGold', 'Bellingham');
  await fillPremio(page, 'ballSilver', 'Vinicius');
  await fillPremio(page, 'ballBronze', 'Rodri');

  await page.reload();
  await expect(page.getByTestId('porra-tab-mark-premios')).toHaveAttribute(
    'aria-label',
    'completo',
  );

  await gotoPremios(page);
  await expect(page.getByTestId('premios-input-ballBronze')).toHaveValue('Rodri');
});

test('premios – repetir jugador en dos botas muestra el error de distinción', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);
  await gotoPremios(page);

  await fillPremio(page, 'bootGold', 'Mbappé');

  // Mismo jugador en la bota de plata → duplicado, no se guarda y aparece error.
  await page.getByTestId('premios-input-bootSilver').fill('Mbappé');
  await expect(page.getByTestId('premios-boots-error')).toBeVisible();
  await expect(page.getByTestId('premios-boots-error')).toContainText(
    'Cada bota debe ser un jugador diferente',
  );
});

test('premios – el mismo jugador en bota y balón está permitido', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);
  await gotoPremios(page);

  await fillPremio(page, 'bootGold', 'Mbappé');
  // No debe disparar error: bota y balón no se cruzan.
  await fillPremio(page, 'ballGold', 'Mbappé');

  await expect(page.getByTestId('premios-boots-error')).toHaveCount(0);
  await expect(page.getByTestId('premios-balls-error')).toHaveCount(0);

  await page.reload();
  await gotoPremios(page);
  await expect(page.getByTestId('premios-input-bootGold')).toHaveValue('Mbappé');
  await expect(page.getByTestId('premios-input-ballGold')).toHaveValue('Mbappé');
});
