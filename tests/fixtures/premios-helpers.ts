/**
 * Helpers compartidos por los specs e2e del tab Premios.
 * No modifican código de producción.
 */
import { expect, type Page } from '@playwright/test';

import { waitForFreshSave } from './wait-helpers';

/** Abre el tab Premios y espera a que el panel y el componente sean visibles. */
export async function gotoPremios(page: Page): Promise<void> {
  await page.getByTestId('porra-tab-premios').click();
  await expect(page.getByTestId('porra-panel-premios')).toBeVisible();
  await expect(page.getByTestId('premios-tab')).toBeVisible();
}

/** Escribe un nombre en un campo de premio y espera el autosave. */
export async function fillPremio(
  page: Page,
  key: string,
  name: string,
): Promise<void> {
  await page.getByTestId(`premios-input-${key}`).fill(name);
  await waitForFreshSave(page, 'premios-autosave-status');
}
