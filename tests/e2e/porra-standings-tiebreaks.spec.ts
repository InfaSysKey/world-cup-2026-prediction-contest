/**
 * Cobertura de los DESEMPATES de grupo (scoring-rules.md §2.3 / ADR 0007),
 * sub-slice 4.3, rediseño slice 10.
 *
 * Regla de negocio:
 *   - El desempate solo se evalúa cuando el grupo está COMPLETO (6 marcadores).
 *   - Se considera empate únicamente a los equipos iguales en la cadena
 *     puntos → diferencia de goles → goles a favor. Si GD o GF ya los separan,
 *     NO hay empate aunque coincidan los puntos.
 *   - No hay un segundo control: los equipos empatados se RESALTAN dentro de la
 *     lista de orden del grupo (li[data-tied="true"]) y debajo aparece una nota
 *     (gs-tie-note-<grupo>). El orden que el usuario les dé en esa misma lista es
 *     su desempate, y se guarda con el autosave del orden de grupo.
 *
 * Grupo A del seed, orden en el DOM de los marcadores (scheduled_at ASC):
 *   nth(0) MEX vs ZAF
 *   nth(1) KOR vs CZE
 *   nth(2) CZE vs ZAF
 *   nth(3) MEX vs KOR
 *   nth(4) ZAF vs KOR
 *   nth(5) CZE vs MEX
 *
 * Orden por defecto de la lista de orden (equipos por código ASC): CZE, KOR, MEX, ZAF.
 *
 * Casos:
 *   T1.  Sin marcadores: no hay filas resaltadas ni nota.
 *   T1b. Marcadores sin empate (puntos distintos): no hay resaltado.
 *   Tgd. Empate SOLO a puntos roto por diferencia de goles: no hay resaltado.
 *   T2.  Empate real entre 2 equipos: se resaltan, se reordena, autosave, persiste.
 *   T3.  Empate real triple: 3 filas resaltadas.
 *   T4.  Dos bloques empatados en el mismo grupo: las 4 filas resaltadas + nota.
 *   T5.  Cambiar marcador que ROMPE el empate (por GD): el resaltado desaparece.
 *   T5b. Restituir el marcador que vuelve a empatar: el resaltado reaparece.
 *
 * Corre con el project "chromium" (TOURNAMENT_START_AT en el futuro).
 */
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { registerAndLand } from '../fixtures/auth-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Rellena los 6 marcadores de la primera sección (grupo A) con los scores dados.
 * scores[i] = [local, visitante] para el i-ésimo partido en orden del DOM.
 */
async function fillGroupA(
  page: Page,
  scores: [string, string][],
): Promise<void> {
  const section = page
    .locator('[data-testid="group-matches-tab"] section')
    .first();
  const localInputs = section.locator('[data-testid^="gm-local-"]');
  const awayInputs = section.locator('[data-testid^="gm-visitante-"]');
  const count = await localInputs.count();
  expect(count).toBe(6);
  for (let i = 0; i < count; i++) {
    await localInputs.nth(i).fill(scores[i][0]);
    await awayInputs.nth(i).fill(scores[i][1]);
  }
}

/** Lee los códigos de equipo RESALTADOS (empatados) de la lista de orden de un grupo. */
async function tiedRows(page: Page, groupLetter: string): Promise<string[]> {
  const items = page.locator(
    `[data-testid="gs-order-${groupLetter}"] > li[data-tied="true"]`,
  );
  const count = await items.count();
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const tid = await items.nth(i).getAttribute('data-testid');
    codes.push((tid ?? '').replace(`gs-order-${groupLetter}-item-`, ''));
  }
  return codes;
}

/** Lee el orden actual del grupo desde la SortableList principal. */
async function groupOrder(page: Page, groupLetter: string): Promise<string[]> {
  const items = page.locator(`[data-testid="gs-order-${groupLetter}"] > li`);
  const count = await items.count();
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const tid = await items.nth(i).getAttribute('data-testid');
    codes.push((tid ?? '').replace(`gs-order-${groupLetter}-item-`, ''));
  }
  return codes;
}

// ---------------------------------------------------------------------------
// Marcadores precalculados para el grupo A
//
// DOM: nth0 MEX-ZAF, nth1 KOR-CZE, nth2 CZE-ZAF, nth3 MEX-KOR, nth4 ZAF-KOR, nth5 CZE-MEX
// (los esperados de pts/GD/GF están calculados a mano, ver tabla en cada bloque)
// ---------------------------------------------------------------------------

// MEX=9, KOR=6, CZE=3, ZAF=0 → puntos distintos, sin empate.
const SCORES_NO_TIE: [string, string][] = [
  ['3', '0'],
  ['1', '0'],
  ['2', '0'],
  ['1', '0'],
  ['0', '1'],
  ['0', '1'],
];

// MEX=ZAF=2 puntos, pero GD −3 vs −2 → empate SOLO a puntos, separado por GD.
// (KOR=7, CZE=4.) Bajo la cadena pts→GD→GF NO hay empate que resolver.
const SCORES_POINTS_TIE_ONLY: [string, string][] = [
  ['0', '0'],
  ['1', '0'],
  ['2', '0'],
  ['0', '3'],
  ['0', '0'],
  ['0', '0'],
];

// Empate REAL entre 2: MEX=KOR (7 pts, GD +4, GF 5). CZE=3, ZAF=0 separados.
//   nth0 MEX-ZAF 2-0, nth1 KOR-CZE 2-0, nth2 CZE-ZAF 1-0,
//   nth3 MEX-KOR 1-1, nth4 ZAF-KOR 0-2, nth5 CZE-MEX 0-2
const SCORES_REAL_TWO_TIE: [string, string][] = [
  ['2', '0'],
  ['2', '0'],
  ['1', '0'],
  ['1', '1'],
  ['0', '2'],
  ['0', '2'],
];

// Empate REAL triple: MEX=KOR=ZAF (6 pts, GD +2, GF 3). CZE=0, último.
//   nth0 MEX-ZAF 0-1, nth1 KOR-CZE 2-0, nth2 CZE-ZAF 0-2,
//   nth3 MEX-KOR 1-0, nth4 ZAF-KOR 0-1, nth5 CZE-MEX 0-2
const SCORES_REAL_TRIPLE_TIE: [string, string][] = [
  ['0', '1'],
  ['2', '0'],
  ['0', '2'],
  ['1', '0'],
  ['0', '1'],
  ['0', '2'],
];

// Dos bloques REALES: MEX=KOR (7, +4, 5) y CZE=ZAF (1, −4, 1).
//   nth0 MEX-ZAF 2-0, nth1 KOR-CZE 2-0, nth2 CZE-ZAF 1-1,
//   nth3 MEX-KOR 1-1, nth4 ZAF-KOR 0-2, nth5 CZE-MEX 0-2
const SCORES_TWO_BLOCKS: [string, string][] = [
  ['2', '0'],
  ['2', '0'],
  ['1', '1'],
  ['1', '1'],
  ['0', '2'],
  ['0', '2'],
];

// ---------------------------------------------------------------------------
// T1: Sin marcadores → ni resaltado ni nota
// ---------------------------------------------------------------------------
test('desempate T1 – sin marcadores, ningún equipo resaltado ni nota', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-standings-tab')).toBeVisible();

  await expect(
    page.locator('[data-testid^="gs-order-"] > li[data-tied="true"]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-testid^="gs-tie-note-"]')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// T1b: Marcadores con puntos distintos → sin resaltado
// ---------------------------------------------------------------------------
test('desempate T1b – marcadores sin empate no resaltan ningún equipo', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();
  await fillGroupA(page, SCORES_NO_TIE);

  expect(await tiedRows(page, 'A')).toEqual([]);
  await expect(page.getByTestId('gs-tie-note-A')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Tgd: Empate SOLO a puntos roto por diferencia de goles → sin resaltado
//      (esta es la regresión que arregla ADR 0007)
// ---------------------------------------------------------------------------
test('desempate Tgd – empate solo a puntos roto por GD no resalta nada', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // MEX=ZAF=2 puntos pero distinta diferencia de goles → no es empate real.
  await fillGroupA(page, SCORES_POINTS_TIE_ONLY);

  expect(await tiedRows(page, 'A')).toEqual([]);
  await expect(page.getByTestId('gs-tie-note-A')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// T2: Empate real entre 2 equipos → resaltado, reorden, autosave, persiste
// ---------------------------------------------------------------------------
test('desempate T2 – empate real entre 2 equipos: resalta, se reordena y persiste', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();
  await fillGroupA(page, SCORES_REAL_TWO_TIE);

  // Exactamente MEX y KOR quedan empatados (7 pts, GD +4, GF 5).
  const tied = await tiedRows(page, 'A');
  expect(tied.sort()).toEqual(['KOR', 'MEX']);
  await expect(page.getByTestId('gs-tie-note-A')).toBeVisible();

  // Reordenar dentro de la lista principal: bajar KOR (intercambia con MEX).
  const orderBefore = await groupOrder(page, 'A');
  await page.getByTestId('gs-order-A-down-KOR').click();

  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  const orderAfter = await groupOrder(page, 'A');
  expect(orderAfter).not.toEqual(orderBefore);

  // Persiste tras recarga.
  await page.reload();
  await expect(page.getByTestId('group-standings-tab')).toBeVisible();
  expect(await groupOrder(page, 'A')).toEqual(orderAfter);
});

// ---------------------------------------------------------------------------
// T3: Empate real triple → 3 filas resaltadas
// ---------------------------------------------------------------------------
test('desempate T3 – empate real triple: 3 equipos resaltados', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();
  await fillGroupA(page, SCORES_REAL_TRIPLE_TIE);

  const tied = await tiedRows(page, 'A');
  expect(tied.sort()).toEqual(['KOR', 'MEX', 'ZAF']);
  await expect(page.getByTestId('gs-tie-note-A')).toBeVisible();
});

// ---------------------------------------------------------------------------
// T4: Dos bloques empatados en el mismo grupo → las 4 filas resaltadas
// ---------------------------------------------------------------------------
test('desempate T4 – dos bloques de empate: las 4 filas del grupo resaltadas', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();
  await fillGroupA(page, SCORES_TWO_BLOCKS);

  // MEX=KOR (7) y CZE=ZAF (1): los cuatro quedan en algún bloque empatado.
  const tied = await tiedRows(page, 'A');
  expect(tied.sort()).toEqual(['CZE', 'KOR', 'MEX', 'ZAF']);
  await expect(page.getByTestId('gs-tie-note-A')).toBeVisible();
});

// ---------------------------------------------------------------------------
// T5: Cambiar marcador que ROMPE el empate (por GD) → el resaltado desaparece
// ---------------------------------------------------------------------------
test('desempate T5 – romper el empate por GD: el resaltado desaparece', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();
  await fillGroupA(page, SCORES_REAL_TWO_TIE);
  expect((await tiedRows(page, 'A')).sort()).toEqual(['KOR', 'MEX']);

  // Romper el empate: nth5 CZE-MEX de 0-2 a 0-1 (MEX baja a GF 4 → MEX≠KOR).
  const section = page
    .locator('[data-testid="group-matches-tab"] section')
    .first();
  const awayInputs = section.locator('[data-testid^="gm-visitante-"]');
  await awayInputs.nth(5).fill('1');

  // El resaltado se recalcula en vivo en cliente y desaparece.
  expect(await tiedRows(page, 'A')).toEqual([]);
  await expect(page.getByTestId('gs-tie-note-A')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// T5b: Restituir el marcador que vuelve a empatar → el resaltado reaparece
// ---------------------------------------------------------------------------
test('desempate T5b – restituir el empate: el resaltado reaparece', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();
  await fillGroupA(page, SCORES_REAL_TWO_TIE);
  expect((await tiedRows(page, 'A')).sort()).toEqual(['KOR', 'MEX']);

  const section = page
    .locator('[data-testid="group-matches-tab"] section')
    .first();
  const awayInputs = section.locator('[data-testid^="gm-visitante-"]');

  // Romper (0-1) y luego restaurar (0-2) el marcador de CZE-MEX.
  await awayInputs.nth(5).fill('1');
  expect(await tiedRows(page, 'A')).toEqual([]);

  await awayInputs.nth(5).fill('2');
  expect((await tiedRows(page, 'A')).sort()).toEqual(['KOR', 'MEX']);
  await expect(page.getByTestId('gs-tie-note-A')).toBeVisible();
});
