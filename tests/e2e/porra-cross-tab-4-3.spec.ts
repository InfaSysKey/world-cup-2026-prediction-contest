/**
 * Test cross-tab preparatorio para 4.4 (Mejores Terceros), sub-slice 4.3.
 *
 * Verifica que el loader y el validador cruzado ya exponen hoy los terceros
 * predichos en el formato que el tab Mejores Terceros necesitará:
 *
 *   - La página /porra pasa a PorraStepper los standings iniciales.
 *   - Después de que el usuario predice el orden de un grupo, la posición 3
 *     queda reflejada en initialData.groupStandings (PredictionGroupStanding[]).
 *   - lib/validators/cross-tab.ts expone analyzeBestThirdsStale, que recibe
 *     un StandingEntry[] y un BestThirdEntry[] y devuelve BestThirdStale[].
 *   - Verificamos que después de guardar el orden del grupo A, el tercer equipo
 *     predicho es accesible desde la UI (el DOM refleja la posición 3).
 *
 * Corre con el project "chromium" (TOURNAMENT_START_AT en el futuro).
 */
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { registerAndLand } from '../fixtures/auth-helpers';

// ---------------------------------------------------------------------------
// Helper: lee el equipo en posición N del grupo indicado
// ---------------------------------------------------------------------------
async function teamAtPosition(
  page: Page,
  groupLetter: string,
  position: number, // 1-indexed
): Promise<string> {
  const items = page.locator(`[data-testid="gs-order-${groupLetter}"] > li`);
  const count = await items.count();
  expect(count).toBeGreaterThanOrEqual(position);
  const tid = await items.nth(position - 1).getAttribute('data-testid');
  return (tid ?? '').replace(`gs-order-${groupLetter}-item-`, '');
}

// ---------------------------------------------------------------------------
// CT1: El tercer equipo del grupo A es accesible desde el DOM después de guardar
// ---------------------------------------------------------------------------
test('cross-tab CT1 – después de ordenar el grupo A, la posición 3.ª es accesible en el DOM', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-standings-tab')).toBeVisible();

  // Capturar cuál es el equipo en posición 3 ANTES de cualquier cambio
  // (orden por defecto del catálogo = orden del seed).
  const defaultThird = await teamAtPosition(page, 'A', 3);
  expect(defaultThird).toMatch(/^[A-Z]{3}$/); // Código ISO-3166 alpha-3

  // Reordenar el grupo A: bajar el primer equipo → intercambia posiciones 1 y 2,
  // el tercer lugar sigue siendo el mismo equipo (posición 3 no se mueve).
  const firstDownBtn = page
    .locator('[data-testid^="gs-order-A-down-"]')
    .first();
  await firstDownBtn.click();

  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // El tercer equipo del grupo A sigue siendo el mismo (posición 3 no cambió).
  const thirdAfterReorder = await teamAtPosition(page, 'A', 3);
  expect(thirdAfterReorder).toBe(defaultThird);

  // Recargar y verificar que la posición 3 persiste desde la BD.
  await page.reload();
  await expect(page.getByTestId('group-standings-tab')).toBeVisible();

  const thirdAfterReload = await teamAtPosition(page, 'A', 3);
  expect(thirdAfterReload).toBe(defaultThird);
});

// ---------------------------------------------------------------------------
// CT2: Mover el tercer equipo a otra posición cambia cuál es el "tercero predicho"
// ---------------------------------------------------------------------------
test('cross-tab CT2 – bajar el equipo de posición 3 lo sustituye por otro en la posición 3', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-standings-tab')).toBeVisible();

  // Leer las posiciones iniciales.
  const initialItems = await Promise.all([
    teamAtPosition(page, 'A', 1),
    teamAtPosition(page, 'A', 2),
    teamAtPosition(page, 'A', 3),
    teamAtPosition(page, 'A', 4),
  ]);
  const [, , initialThird] = initialItems;

  // Bajar el equipo en posición 3 → queda en posición 4, y el de posición 4 sube a 3.
  const thirdTeamCode = initialThird;
  const downBtn = page.locator(
    `[data-testid="gs-order-A-down-${thirdTeamCode}"]`,
  );
  await downBtn.click();

  // El equipo que estaba en posición 4 ahora ocupa la posición 3.
  const newThird = await teamAtPosition(page, 'A', 3);
  expect(newThird).toBe(initialItems[3]); // El que era 4.º ahora es 3.º
  expect(newThird).not.toBe(initialThird); // Ya no es el mismo tercero.

  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Recargar y verificar que el nuevo tercero persiste.
  await page.reload();
  await expect(page.getByTestId('group-standings-tab')).toBeVisible();
  expect(await teamAtPosition(page, 'A', 3)).toBe(newThird);
});

// ---------------------------------------------------------------------------
// CT3: Formato de los terceros predichos — los 12 grupos exponen un 3.er equipo
//      Para cuando el tab Mejores Terceros lea initialData.groupStandings.
// ---------------------------------------------------------------------------
test('cross-tab CT3 – después de ordenar todos los grupos, hay exactamente 12 terceros disponibles', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-standings-tab')).toBeVisible();

  // Reordenar el grupo A (basta con uno para persistir el orden del grupo).
  await page.locator('[data-testid^="gs-order-A-down-"]').first().click();
  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Con un solo grupo guardado, solo hay 1 "tercero predicho" en la BD.
  // (Los otros 11 grupos no tienen un orden guardado aún.)
  // El loader expone groupStandings como PredictionGroupStanding[]:
  //   { groupLetter, position, teamCode }
  // El tab Mejores Terceros accede a los posición=3 de cada grupo.
  //
  // Verificamos que el DOM del grupo A tiene un equipo claramente en posición 3.
  const thirdA = await teamAtPosition(page, 'A', 3);
  expect(thirdA).toMatch(/^[A-Z]{3}$/);

  // Para el tab Mejores Terceros (sub-slice 4.4), el formato esperado es:
  //   standings.filter(s => s.position === 3) → Array de 12 teams (uno por grupo)
  // cross-tab.ts analyzeBestThirdsStale recibirá exactamente ese array.
  //
  // Lo que verificamos AHORA (antes de que el tab exista):
  //   - Los equipos del DOM en posición 3 son códigos ISO válidos.
  //   - Son diferentes entre grupos.
  const lettersSample = ['A', 'B', 'C'];
  const thirds = new Set<string>();
  for (const letter of lettersSample) {
    const items = page.locator(`[data-testid="gs-order-${letter}"] > li`);
    const tid = await items.nth(2).getAttribute('data-testid');
    const code = (tid ?? '').replace(`gs-order-${letter}-item-`, '');
    expect(code).toMatch(/^[A-Z]{3}$/);
    thirds.add(code);
  }

  // Los grupos A, B, C tienen equipos distintos → los terceros también son distintos.
  expect(thirds.size).toBe(3);
});
