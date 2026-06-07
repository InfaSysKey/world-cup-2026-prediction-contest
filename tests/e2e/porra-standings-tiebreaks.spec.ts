/**
 * Cobertura de los DESEMPATES de grupo (scoring-rules.md §2.3), sub-slice 4.3.
 *
 * Regla de negocio:
 *   - Cuando los marcadores predichos generan empate a puntos entre equipos del
 *     mismo grupo, el formulario muestra un sub-componente de desempate con los
 *     equipos empatados en una SortableList arrastrable (data-testid gs-tiebreak-*).
 *   - Si no hay empate matemático, el sub-componente NO aparece.
 *   - Varios empates independientes en el mismo grupo aparecen como bloques
 *     separados (hasta 6 según §2.3).
 *   - El desempate se guarda junto con el orden global del grupo (autosave).
 *
 * Grupo A del seed, orden en el DOM (scheduled_at ASC):
 *   nth(0) id=1:  MEX vs ZAF  (J1)
 *   nth(1) id=2:  KOR vs CZE  (J1)
 *   nth(2) id=25: CZE vs ZAF  (J2)
 *   nth(3) id=28: MEX vs KOR  (J2)
 *   nth(4) id=54: ZAF vs KOR  (J3)  ← NOTA: el id 54 precede al 53 en el DOM
 *   nth(5) id=53: CZE vs MEX  (J3)
 *
 * Casos:
 *   T1.  Sin marcadores: el sub-componente no aparece.
 *   T1b. Marcadores sin empate: el sub-componente no aparece.
 *   T2.  Empate entre 2 equipos: aparece el desempate, se reordena, autosave, persiste.
 *   T3.  Empate triple (3 equipos): aparece con 3 equipos arrastrables.
 *   T4.  Dos bloques de empate en el mismo grupo: ambos bloques aparecen y guardan.
 *   T5.  Cambio de marcador que ROMPE el empate: sub-componente desaparece.
 *   T5b. Restituir el marcador que vuelve a empatar: sub-componente reaparece.
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
 * Orden real del DOM del grupo A:
 *   nth(0) MEX-ZAF, nth(1) KOR-CZE, nth(2) CZE-ZAF,
 *   nth(3) MEX-KOR, nth(4) ZAF-KOR, nth(5) CZE-MEX
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

/** Lee los IDs de equipo de un bloque de desempate específico. */
async function tiebreakBlockItems(
  page: Page,
  groupLetter: string,
  blockIndex: number,
): Promise<string[]> {
  const block = page.getByTestId(`gs-tiebreak-${groupLetter}-${blockIndex}`);
  await expect(block).toBeVisible();
  const items = block.locator('li');
  const count = await items.count();
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const tid = await items.nth(i).getAttribute('data-testid');
    const code = (tid ?? '').replace(`gs-tie-${groupLetter}-${blockIndex}-item-`, '');
    codes.push(code);
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
// Orden del DOM: nth(0) MEX-ZAF, nth(1) KOR-CZE, nth(2) CZE-ZAF,
//                nth(3) MEX-KOR, nth(4) ZAF-KOR, nth(5) CZE-MEX
//
// SIN EMPATE (MEX=9, KOR=6, CZE=3, ZAF=0):
//   [3-0, 1-0, 2-0, 1-0, 0-1, 0-1]
//
// EMPATE DOBLE MEX=ZAF=2 (KOR=7, CZE=4):
//   [0-0, 1-0, 2-0, 0-3, 0-0, 0-0]
//
// EMPATE TRIPLE MEX=KOR=ZAF=4 (CZE=3):
//   MEX gana ZAF, KOR gana MEX, ZAF gana KOR (ciclo) + empates con CZE.
//   [1-0, 0-0, 0-0, 0-1, 1-0, 0-0]
//   MEX: P0(+3) P5(+1) = 4, KOR: P1(+1) P3(+3) = 4, ZAF: P2(+1) P4(+3) = 4, CZE: P1(+1) P2(+1) P5(+1) = 3
//
// DOS BLOQUES MEX=KOR=7 y ZAF=CZE=1:
//   [3-0, 3-0, 0-0, 0-0, 0-3, 0-3]
//   MEX: P0(+3) P3(+1) P5(away gana → MEX+3) = 7
//   KOR: P1(+3) P3(+1) P4(away gana → KOR+3) = 7
//   CZE: P1(0) P2(+1) P5(0) = 1
//   ZAF: P0(0) P2(+1) P4(0) = 1
// ---------------------------------------------------------------------------

const SCORES_NO_TIE: [string, string][] = [
  ['3', '0'], // nth(0) MEX vs ZAF: MEX gana → MEX+3
  ['1', '0'], // nth(1) KOR vs CZE: KOR gana → KOR+3
  ['2', '0'], // nth(2) CZE vs ZAF: CZE gana → CZE+3
  ['1', '0'], // nth(3) MEX vs KOR: MEX gana → MEX+3
  ['0', '1'], // nth(4) ZAF vs KOR: KOR gana → KOR+3
  ['0', '1'], // nth(5) CZE vs MEX: MEX gana → MEX+3
  // Totales: MEX=9, KOR=6, CZE=3, ZAF=0 → sin empate
];

const SCORES_TWO_TEAM_TIE: [string, string][] = [
  ['0', '0'], // nth(0) MEX vs ZAF: empate → MEX+1, ZAF+1
  ['1', '0'], // nth(1) KOR vs CZE: KOR gana → KOR+3
  ['2', '0'], // nth(2) CZE vs ZAF: CZE gana → CZE+3
  ['0', '3'], // nth(3) MEX vs KOR: KOR gana → KOR+3
  ['0', '0'], // nth(4) ZAF vs KOR: empate → ZAF+1, KOR+1
  ['0', '0'], // nth(5) CZE vs MEX: empate → CZE+1, MEX+1
  // Totales: MEX=2, ZAF=2, KOR=7, CZE=4 → MEX=ZAF=2 (empate doble)
];

const SCORES_TRIPLE_TIE: [string, string][] = [
  ['1', '0'], // nth(0) MEX vs ZAF: MEX gana → MEX+3
  ['0', '0'], // nth(1) KOR vs CZE: empate → KOR+1, CZE+1
  ['0', '0'], // nth(2) CZE vs ZAF: empate → CZE+1, ZAF+1
  ['0', '1'], // nth(3) MEX vs KOR: KOR gana → KOR+3
  ['1', '0'], // nth(4) ZAF vs KOR: ZAF gana → ZAF+3
  ['0', '0'], // nth(5) CZE vs MEX: empate → CZE+1, MEX+1
  // Totales: MEX=4, KOR=4, ZAF=4, CZE=3 → MEX=KOR=ZAF=4 (triple empate)
];

const SCORES_TWO_BLOCKS: [string, string][] = [
  ['3', '0'], // nth(0) MEX vs ZAF: MEX gana → MEX+3
  ['3', '0'], // nth(1) KOR vs CZE: KOR gana → KOR+3
  ['0', '0'], // nth(2) CZE vs ZAF: empate → CZE+1, ZAF+1
  ['0', '0'], // nth(3) MEX vs KOR: empate → MEX+1, KOR+1
  ['0', '3'], // nth(4) ZAF vs KOR: KOR gana → KOR+3
  ['0', '3'], // nth(5) CZE vs MEX: MEX gana (away) → MEX+3
  // Totales: MEX=7, KOR=7, CZE=1, ZAF=1 → MEX=KOR (bloque 1), CZE=ZAF (bloque 2)
];

// ---------------------------------------------------------------------------
// T1: Sin marcadores: el sub-componente no aparece
// ---------------------------------------------------------------------------
test('desempate T1 – sin marcadores completados, no hay sub-componente de desempate', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-standings-tab')).toBeVisible();

  // Un usuario nuevo sin marcadores no tiene ningún bloque de desempate.
  await expect(page.locator('[data-testid^="gs-tiebreak-"]')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// T1b: Marcadores que NO generan empate → sub-componente no aparece
// ---------------------------------------------------------------------------
test('desempate T1b – marcadores sin empate no muestran sub-componente', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // MEX=9, KOR=6, CZE=3, ZAF=0 → todos con puntos distintos.
  await fillGroupA(page, SCORES_NO_TIE);

  // Sin empate a puntos: no aparece ningún bloque de desempate para el grupo A.
  await expect(page.getByTestId('gs-tiebreak-A-0')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// T2: Empate entre 2 equipos → aparece, se reordena, autosave, persiste
// ---------------------------------------------------------------------------
test('desempate T2 – empate entre 2 equipos: aparece desempate, se reordena, persiste', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // MEX=ZAF=2, KOR=7, CZE=4 → empate doble entre MEX y ZAF.
  await fillGroupA(page, SCORES_TWO_TEAM_TIE);

  // El sub-componente de desempate A-0 debe aparecer (calculado en vivo).
  await expect(page.getByTestId('gs-tiebreak-A-0')).toBeVisible();

  // El bloque debe tener exactamente 2 equipos (MEX y ZAF).
  const tiedTeams = await tiebreakBlockItems(page, 'A', 0);
  expect(tiedTeams).toHaveLength(2);
  expect(tiedTeams).toContain('MEX');
  expect(tiedTeams).toContain('ZAF');

  // Bajar el primer equipo del bloque de desempate (intercambia los 2).
  const tieDownBtn = page
    .getByTestId('gs-tiebreak-A-0')
    .locator('[data-testid^="gs-tie-A-0-down-"]')
    .first();
  await tieDownBtn.click();

  // El autosave del tab de standings debe confirmar guardado.
  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // El bloque debe reordenarse: los dos equipos intercambian posiciones.
  const tiedTeamsAfterSwap = await tiebreakBlockItems(page, 'A', 0);
  expect(tiedTeamsAfterSwap[0]).toBe(tiedTeams[1]);
  expect(tiedTeamsAfterSwap[1]).toBe(tiedTeams[0]);

  // Recargar y verificar que el orden del grupo A persiste.
  const orderBefore = await groupOrder(page, 'A');
  await page.reload();
  await expect(page.getByTestId('group-standings-tab')).toBeVisible();
  const orderAfterReload = await groupOrder(page, 'A');
  expect(orderAfterReload).toEqual(orderBefore);
});

// ---------------------------------------------------------------------------
// T3: Empate triple → sub-componente con 3 equipos
// ---------------------------------------------------------------------------
test('desempate T3 – empate triple: el bloque de desempate tiene 3 equipos arrastrables', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // MEX=KOR=ZAF=4, CZE=3 → triple empate entre MEX, KOR y ZAF.
  await fillGroupA(page, SCORES_TRIPLE_TIE);

  // El bloque de desempate A-0 debe aparecer con 3 equipos empatados.
  await expect(page.getByTestId('gs-tiebreak-A-0')).toBeVisible();
  const tiedTeams = await tiebreakBlockItems(page, 'A', 0);
  expect(tiedTeams).toHaveLength(3);
  expect(tiedTeams).toContain('MEX');
  expect(tiedTeams).toContain('KOR');
  expect(tiedTeams).toContain('ZAF');
});

// ---------------------------------------------------------------------------
// T4: Dos bloques de empate en el mismo grupo
// ---------------------------------------------------------------------------
test('desempate T4 – dos bloques de empate independientes en el mismo grupo', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // MEX=KOR=7 y ZAF=CZE=1 → dos bloques independientes.
  await fillGroupA(page, SCORES_TWO_BLOCKS);

  // Deben aparecer dos bloques de desempate para el grupo A.
  await expect(page.getByTestId('gs-tiebreak-A-0')).toBeVisible();
  await expect(page.getByTestId('gs-tiebreak-A-1')).toBeVisible();

  // El primer bloque (más puntos, 7 pts) tiene MEX y KOR.
  const block0 = await tiebreakBlockItems(page, 'A', 0);
  expect(block0).toHaveLength(2);
  expect(block0).toContain('MEX');
  expect(block0).toContain('KOR');

  // El segundo bloque (menos puntos, 1 pt) tiene ZAF y CZE.
  const block1 = await tiebreakBlockItems(page, 'A', 1);
  expect(block1).toHaveLength(2);
  expect(block1).toContain('ZAF');
  expect(block1).toContain('CZE');

  // Reordenar el primer bloque.
  const tieDown0 = page
    .getByTestId('gs-tiebreak-A-0')
    .locator('[data-testid^="gs-tie-A-0-down-"]')
    .first();
  await tieDown0.click();
  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Reordenar el segundo bloque.
  const tieDown1 = page
    .getByTestId('gs-tiebreak-A-1')
    .locator('[data-testid^="gs-tie-A-1-down-"]')
    .first();
  await tieDown1.click();
  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });
});

// ---------------------------------------------------------------------------
// T5: Cambio de marcador que ROMPE el empate
//
// COMPORTAMIENTO REAL DOCUMENTADO (desde el código de grupos-tab.tsx):
//   - tiedBlocksByGroup se recalcula en VIVO en el cliente cada vez que cambia
//     el estado de scores (useMemo sobre scores).
//   - Si el nuevo marcador elimina el empate, el bloque de desempate desaparece
//     del DOM inmediatamente (sin esperar al autosave).
//   - El orden del grupo principal (SortableList) MANTIENE su estado local
//     (el estado no se resetea al desaparecer el bloque de desempate).
//   - El servidor persiste el último orden guardado antes del cambio de marcador.
// ---------------------------------------------------------------------------
test('desempate T5 – cambiar marcador que rompe el empate: el sub-componente desaparece', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // Crear empate doble MEX=ZAF=2 en el grupo A.
  await fillGroupA(page, SCORES_TWO_TEAM_TIE);
  await expect(page.getByTestId('gs-tiebreak-A-0')).toBeVisible();

  // Reordenar el desempate (MEX y ZAF intercambian) y guardarlo.
  const tieDownBtn = page
    .getByTestId('gs-tiebreak-A-0')
    .locator('[data-testid^="gs-tie-A-0-down-"]')
    .first();
  await tieDownBtn.click();
  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Capturar el orden del grupo A con desempate aplicado.
  const orderWithTie = await groupOrder(page, 'A');

  // Romper el empate: cambiar nth(5) (CZE vs MEX) de 0-0 a 1-0 (CZE gana).
  // Nuevo estado: MEX=1, ZAF=2, KOR=7, CZE=6 → sin empate entre MEX y ZAF.
  const section = page
    .locator('[data-testid="group-matches-tab"] section')
    .first();
  const localInputs = section.locator('[data-testid^="gm-local-"]');

  await localInputs.nth(5).fill('1');

  // El sub-componente de desempate debe desaparecer (calculado en vivo en cliente).
  await expect(page.getByTestId('gs-tiebreak-A-0')).toHaveCount(0);

  // El orden del grupo A con-desempate se preserva en el estado local del componente.
  const orderAfterBreak = await groupOrder(page, 'A');
  expect(orderAfterBreak).toEqual(orderWithTie);

  // Esperar a que el autosave de marcadores complete:
  // debounce 800ms + round-trip al servidor. waitForTimeout es la forma más robusta
  // aquí porque el indicador puede estar en "Guardado" del save anterior y no cambiar
  // visualmente si el nuevo save se completa muy rápido.
  await page.waitForTimeout(3000);

  // Recargar: el servidor carga los marcadores actualizados (1-0 en CZE-MEX).
  await page.reload();
  await expect(page.getByTestId('group-standings-tab')).toBeVisible();
  const orderAfterReload = await groupOrder(page, 'A');
  expect(orderAfterReload).toEqual(orderWithTie);

  // El desempate no reaparece tras recargar (los marcadores guardados no generan empate).
  await expect(page.getByTestId('gs-tiebreak-A-0')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// T5b: Restituir el marcador QUE VUELVE a empatar → sub-componente reaparece
// ---------------------------------------------------------------------------
test('desempate T5b – restituir empate: el sub-componente reaparece con orden preservado', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // Crear empate doble MEX=ZAF=2.
  await fillGroupA(page, SCORES_TWO_TEAM_TIE);
  await expect(page.getByTestId('gs-tiebreak-A-0')).toBeVisible();

  // Reordenar el desempate y guardar.
  const tieDownBtn = page
    .getByTestId('gs-tiebreak-A-0')
    .locator('[data-testid^="gs-tie-A-0-down-"]')
    .first();
  await tieDownBtn.click();
  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  const orderWithTie = await groupOrder(page, 'A');

  // Romper el empate: nth(5) CZE-MEX → 1-0 (CZE gana).
  const section = page
    .locator('[data-testid="group-matches-tab"] section')
    .first();
  const localInputs = section.locator('[data-testid^="gm-local-"]');

  await localInputs.nth(5).fill('1');
  await expect(page.getByTestId('gs-tiebreak-A-0')).toHaveCount(0);

  // Restaurar el marcador original: nth(5) CZE-MEX → 0-0 (vuelve el empate MEX=ZAF=2).
  await localInputs.nth(5).fill('0');

  // El desempate debe reaparecer.
  await expect(page.getByTestId('gs-tiebreak-A-0')).toBeVisible();

  // El orden del grupo A con el desempate previo se ha preservado en el estado local.
  const orderAfterRestore = await groupOrder(page, 'A');
  expect(orderAfterRestore).toEqual(orderWithTie);
});
