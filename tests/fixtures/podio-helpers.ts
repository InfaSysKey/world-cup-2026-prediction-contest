/**
 * Helpers compartidos por los specs e2e del tab Podio.
 * No modifican código de producción.
 */
import { expect, type Page } from '@playwright/test';

import { waitForFreshSave } from './wait-helpers';

/** Abre el tab Podio y espera a que el panel y el componente sean visibles. */
export async function gotoPodio(page: Page): Promise<void> {
  await page.getByTestId('porra-tab-podio').click();
  await expect(page.getByTestId('porra-panel-podio')).toBeVisible();
  await expect(page.getByTestId('podio-tab')).toBeVisible();
}

/**
 * Codes de los primeros `n` equipos del select de campeón (saltando el
 * placeholder ""). Requiere el panel del podio montado para que existan los
 * <option>.
 */
export async function podioTeamCodes(page: Page, n: number): Promise<string[]> {
  const values = await page
    .locator('[data-testid="podio-select-champion"] option')
    .evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== ''),
    );
  return values.slice(0, n);
}

/** Selecciona un equipo en un puesto del podio y espera el autosave. */
export async function pickPodio(
  page: Page,
  key: string,
  code: string,
): Promise<void> {
  await page.getByTestId(`podio-select-${key}`).selectOption(code);
  await waitForFreshSave(page, 'podio-autosave-status');
}
