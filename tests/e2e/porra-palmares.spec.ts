/**
 * Cobertura e2e del tab "Podio + Premios" — sección Podio (sub-slice 4.6).
 *
 * Un usuario recién registrado no tiene predicción de bracket (el tab de
 * eliminatorias aún no existe), así que la deducción es vacía: los 3 selects
 * arrancan vacíos y las líneas de ayuda dicen "Sin predicción … todavía". Eso
 * basta para cubrir el flujo del formulario:
 *   1. Los 3 selects y sus líneas de ayuda (sin deducción) se renderizan.
 *   2. Elegir un campeón → autosave "Guardado" → recarga → persiste.
 *   3. Rellenar los 3 puestos distintos → indicador del stepper "completo".
 *   4. Repetir equipo en dos puestos → error de distinción visible.
 *
 * La deducción desde el bracket y los avisos de sincronización se cubren a nivel
 * unitario (deduce-podium.test.ts, cross-tab.test.ts). El estado bloqueado vive
 * en porra-palmares-locked.spec.ts (project=locked).
 */
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { registerAndLand } from '../fixtures/auth-helpers';

async function gotoPodio(page: Page): Promise<void> {
  await page.getByTestId('porra-tab-palmares').click();
  await expect(page.getByTestId('porra-panel-palmares')).toBeVisible();
  await expect(page.getByTestId('podio-tab')).toBeVisible();
}

/** Devuelve los codes de los 3 primeros equipos (saltando el placeholder ""). */
async function teamCodes(page: Page): Promise<string[]> {
  const values = await page
    .locator('[data-testid="podio-select-champion"] option')
    .evaluateAll((opts) =>
      opts
        .map((o) => (o as HTMLOptionElement).value)
        .filter((v) => v !== ''),
    );
  return values.slice(0, 3);
}

/**
 * Espera a que el autosave complete UN NUEVO ciclo. Si el estado ya es
 * "Guardado" (residual del save anterior), espera primero a que deje de serlo,
 * para no confundir el save viejo con el nuevo (mismo patrón que mejores
 * terceros: el debounce de 800 ms dispara después de la acción).
 */
async function waitForFreshSave(page: Page): Promise<void> {
  const testId = 'podio-autosave-status';
  const current = await page.getByTestId(testId).textContent();
  if (current?.trim() === 'Guardado') {
    await page.waitForFunction(
      (id: string) => {
        const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
        return el !== null && el.textContent?.trim() !== 'Guardado';
      },
      testId,
      { timeout: 4000 },
    );
  }
  await expect(page.getByTestId(testId)).toHaveText('Guardado', { timeout: 6000 });
}

async function pick(page: Page, key: string, code: string): Promise<void> {
  await page.getByTestId(`podio-select-${key}`).selectOption(code);
  await waitForFreshSave(page);
}

test('palmares – los 3 selects y las ayudas sin deducción se renderizan', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);
  await gotoPodio(page);

  await expect(page.getByTestId('podio-select-champion')).toBeVisible();
  await expect(page.getByTestId('podio-select-runnerUp')).toBeVisible();
  await expect(page.getByTestId('podio-select-third')).toBeVisible();

  await expect(page.getByTestId('podio-hint-champion')).toContainText(
    'Sin predicción de la final todavía',
  );
  await expect(page.getByTestId('podio-hint-third')).toContainText(
    'Sin predicción de la 3-4 todavía',
  );
});

test('palmares – elegir un campeón persiste tras recarga', async ({ browser }) => {
  const page = await registerAndLand(browser);
  await gotoPodio(page);

  const [c0] = await teamCodes(page);
  await pick(page, 'champion', c0);

  await page.reload();
  await gotoPodio(page);
  await expect(page.getByTestId('podio-select-champion')).toHaveValue(c0);
});

test('palmares – rellenar los 3 puestos marca el tab como completo', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);
  await gotoPodio(page);

  const [c0, c1, c2] = await teamCodes(page);
  await pick(page, 'champion', c0);
  await pick(page, 'runnerUp', c1);
  await pick(page, 'third', c2);

  await page.reload();
  await expect(page.getByTestId('porra-tab-mark-palmares')).toHaveAttribute(
    'aria-label',
    'completo',
  );

  await gotoPodio(page);
  await expect(page.getByTestId('podio-select-champion')).toHaveValue(c0);
  await expect(page.getByTestId('podio-select-runnerUp')).toHaveValue(c1);
  await expect(page.getByTestId('podio-select-third')).toHaveValue(c2);
});

test('palmares – repetir equipo en dos puestos muestra el error de distinción', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);
  await gotoPodio(page);

  const [c0] = await teamCodes(page);
  await pick(page, 'champion', c0);

  // Mismo equipo en subcampeón → duplicado, no se guarda y aparece el error.
  await page.getByTestId('podio-select-runnerUp').selectOption(c0);
  await expect(page.getByTestId('podio-duplicates-error')).toBeVisible();
  await expect(page.getByTestId('podio-duplicates-error')).toContainText(
    'Cada posición del podio debe ser un equipo diferente',
  );
});
