import { expect, test } from '@playwright/test';

import { PORRA_TABS } from '@/lib/constants';

import { registerAndLand } from '../fixtures/auth-helpers';

test('usuario logueado ve el stepper con todos los tabs', async ({ browser }) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('porra-stepper')).toBeVisible();
  await expect(page.getByTestId('porra-banner')).toContainText('PORRA INCOMPLETA');

  for (const tab of PORRA_TABS) {
    await expect(page.getByTestId(`porra-tab-${tab.id}`)).toBeVisible();
  }

  // El primer tab está activo por defecto.
  await expect(page.getByTestId(`porra-panel-${PORRA_TABS[0].id}`)).toBeVisible();
});

test('el usuario puede navegar entre tabs', async ({ browser }) => {
  const page = await registerAndLand(browser);

  await page.getByTestId('porra-tab-mejores-terceros').click();
  await expect(
    page.getByTestId('porra-panel-mejores-terceros'),
  ).toBeVisible();

  await page.getByTestId('porra-tab-final').click();
  await expect(page.getByTestId('porra-panel-final')).toBeVisible();
});
