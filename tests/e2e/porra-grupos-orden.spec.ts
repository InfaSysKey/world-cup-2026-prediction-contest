/**
 * Cobertura del orden de grupo (sub-slice 4.3), dentro del tab Grupos.
 * Corre con el project "chromium" (TOURNAMENT_START_AT en el futuro).
 *
 * Casos:
 *   1. Reordenar un grupo persiste tras recarga.
 *   2. Reordenar dispara el autosave y muestra "Guardado".
 *   3. Marcadores con empate real resaltan los equipos en la lista de orden.
 *   (El estado bloqueado se cubre en porra-grupos-locked.spec.ts, project=locked.)
 */
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { registerAndLand } from '../fixtures/auth-helpers';

// Lee el orden actual de los equipos del grupo A (lista de codes en orden).
async function groupAOrder(page: Page): Promise<string[]> {
  const items = page.locator('[data-testid="gs-order-A"] > li');
  const count = await items.count();
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const tid = await items.nth(i).getAttribute('data-testid');
    codes.push((tid ?? '').replace('gs-order-A-item-', ''));
  }
  return codes;
}

// ---------------------------------------------------------------------------
// Test 1: Reordenar persiste tras recarga
// ---------------------------------------------------------------------------
test('orden de grupo – reordenar el grupo A persiste tras recargar', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-standings-tab')).toBeVisible();

  const before = await groupAOrder(page);
  expect(before.length).toBe(4);

  // Bajar el primer equipo una posición → se intercambian las posiciones 1 y 2.
  await page.locator('[data-testid^="gs-order-A-down-"]').first().click();

  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  const expected = [before[1], before[0], before[2], before[3]];

  await page.reload();
  await expect(page.getByTestId('group-standings-tab')).toBeVisible();
  expect(await groupAOrder(page)).toEqual(expected);
});

// ---------------------------------------------------------------------------
// Test 2: El autosave confirma con "Guardado"
// ---------------------------------------------------------------------------
test('orden de grupo – reordenar dispara autosave y muestra "Guardado"', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-standings-tab')).toBeVisible();

  // Estado inicial: el usuario no ha tocado nada.
  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Sin cambios');

  await page.locator('[data-testid^="gs-order-B-down-"]').first().click();

  // El estado transitorio "Guardando…" dura menos que el debounce y es inestable
  // de capturar; basta con confirmar que el autosave termina en "Guardado".
  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });
});

// ---------------------------------------------------------------------------
// Test 3: Marcadores empatados resaltan los equipos en la lista de orden
// ---------------------------------------------------------------------------
test('orden de grupo – grupo A completo a 0-0 resalta los 4 equipos empatados', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // Grupo incompleto: ningún equipo resaltado todavía.
  await expect(
    page.locator('[data-testid="gs-order-A"] > li[data-tied="true"]'),
  ).toHaveCount(0);

  // Rellenar los 6 partidos del grupo A a 0-0: los 4 equipos quedan iguales en
  // puntos, diferencia de goles y goles a favor → empate real cuádruple.
  const groupASection = page
    .locator('[data-testid="group-matches-tab"] section')
    .first();
  const localInputs = groupASection.locator('[data-testid^="gm-local-"]');
  const awayInputs = groupASection.locator('[data-testid^="gm-visitante-"]');
  const matchCount = await localInputs.count();
  expect(matchCount).toBe(6);

  for (let i = 0; i < matchCount; i++) {
    await localInputs.nth(i).fill('0');
    await awayInputs.nth(i).fill('0');
  }

  // El resaltado se calcula en vivo en cliente: las 4 filas del grupo A quedan
  // marcadas y aparece la nota de desempate, sin esperar al guardado.
  await expect(
    page.locator('[data-testid="gs-order-A"] > li[data-tied="true"]'),
  ).toHaveCount(4);
  await expect(page.getByTestId('gs-tie-note-A')).toBeVisible();
});
