/**
 * E2E de la clasificación (slice 7.2): la VISTA ordena por puntos, resuelve los
 * desempates de §7 y marca los empates sin resolver. Siembra las filas de
 * `scores` directamente (el motor de puntuación es slice 5 y ya tiene su propio
 * e2e); aquí se prueba la ruta real query (loadRanking) → rankPlayers → render.
 * Corre en modo abierto con un visitante autenticado por el flujo real.
 */
import { expect, test, type Page } from '@playwright/test';
import { inArray } from 'drizzle-orm';

import { db, scores, users, type ScoreCategory } from '@/lib/db';

import { registerAndLand, uniqueSuffix } from '../fixtures/auth-helpers';

let nickHigh: string;
let nickLow: string;
// Empate total (§7.8): dos jugadores idénticos en las 8 métricas → mismo rango +
// badge de sorteo pendiente.
let nickTieA: string;
let nickTieB: string;
// Empate a puntos roto por §7.1 (más marcadores exactos de grupo): el de más
// exactos arriba, ninguno marcado como empate.
let nickT1High: string;
let nickT1Low: string;
const createdIds: number[] = [];

type ScoreSeed = {
  category: ScoreCategory;
  points: number;
  detail: unknown;
};

async function createPlayerWithScores(
  nickname: string,
  rows: readonly ScoreSeed[],
): Promise<number> {
  const [created] = await db
    .insert(users)
    .values({
      email: `${nickname}@test.dev`,
      passwordHash: 'x',
      nombre: 'Rank',
      apellidos: 'Player',
      nickname,
      isAdmin: false,
    })
    .returning({ id: users.id });
  await db
    .insert(scores)
    .values(rows.map((r) => ({ userId: created.id, ...r })));
  return created.id;
}

function groupMatches(points: number, exact: number): ScoreSeed {
  return {
    category: 'group_matches',
    points,
    detail: {
      reasons: { exact, result: 0, one_goal: 0, wrong: 0 },
      gaps: 0,
    },
  };
}

function createPlayer(nickname: string, points: number): Promise<number> {
  return createPlayerWithScores(nickname, [groupMatches(points, 0)]);
}

// Índice de fila (0-based) de un nickname dentro de la tabla de ranking.
async function rowIndexOf(page: Page, nickname: string): Promise<number> {
  const texts = await page.getByTestId('ranking-row').allInnerTexts();
  return texts.findIndex((t) => t.includes(nickname));
}

test.beforeAll(async () => {
  const suffix = uniqueSuffix();
  nickHigh = `rank_high_${suffix}`;
  nickLow = `rank_low_${suffix}`;
  createdIds.push(await createPlayer(nickHigh, 100));
  createdIds.push(await createPlayer(nickLow, 40));

  // Empate total: ambos con idénticas filas → empatan en las 8 métricas de §7.
  nickTieA = `rank_tie_a_${suffix}`;
  nickTieB = `rank_tie_b_${suffix}`;
  const tieRows: ScoreSeed[] = [
    groupMatches(50, 4),
    { category: 'podium', points: 20, detail: { hits: ['champion'] } },
  ];
  createdIds.push(await createPlayerWithScores(nickTieA, tieRows));
  createdIds.push(await createPlayerWithScores(nickTieB, tieRows));

  // Empate a 60 puntos, roto por §7.1: high tiene 4 marcadores exactos, low 1.
  nickT1High = `rank_t1_high_${suffix}`;
  nickT1Low = `rank_t1_low_${suffix}`;
  createdIds.push(await createPlayerWithScores(nickT1High, [groupMatches(60, 4)]));
  createdIds.push(await createPlayerWithScores(nickT1Low, [groupMatches(60, 1)]));
});

test.afterAll(async () => {
  await db.delete(users).where(inArray(users.id, createdIds)); // cascade borra scores
});

test('dos usuarios con puntos distintos se ordenan correctamente', async ({
  browser,
}) => {
  const viewer = await registerAndLand(browser);

  await viewer.goto('/clasificacion');
  await expect(
    viewer.getByRole('heading', { name: 'Clasificación' }),
  ).toBeVisible();

  const rowTexts = await viewer.getByTestId('ranking-row').allInnerTexts();
  const idxHigh = rowTexts.findIndex((t) => t.includes(nickHigh));
  const idxLow = rowTexts.findIndex((t) => t.includes(nickLow));

  expect(idxHigh).toBeGreaterThanOrEqual(0);
  expect(idxLow).toBeGreaterThanOrEqual(0);
  // Más puntos → posición superior (índice menor).
  expect(idxHigh).toBeLessThan(idxLow);
  // Y los puntos sembrados se muestran.
  expect(rowTexts[idxHigh]).toContain('100');
  expect(rowTexts[idxLow]).toContain('40');
});

test('§7.8: empate total → mismo rango y badge de sorteo pendiente', async ({
  browser,
}) => {
  const viewer = await registerAndLand(browser);
  await viewer.goto('/clasificacion');
  await expect(
    viewer.getByRole('heading', { name: 'Clasificación' }),
  ).toBeVisible();

  // Las dos filas de los empatados comparten el MISMO número de posición y ambas
  // muestran el badge "empate" (needsDraw → pendiente de sorteo §7.8).
  const rowA = viewer.getByTestId('ranking-row').filter({ hasText: nickTieA });
  const rowB = viewer.getByTestId('ranking-row').filter({ hasText: nickTieB });

  const rankA = (await rowA.getByTestId('ranking-rank').innerText()).trim();
  const rankB = (await rowB.getByTestId('ranking-rank').innerText()).trim();
  expect(rankA).toBe(rankB);

  await expect(rowA.getByText('empate')).toBeVisible();
  await expect(rowB.getByText('empate')).toBeVisible();
});

test('§7.1: empate a puntos lo rompe quien tiene más marcadores exactos', async ({
  browser,
}) => {
  const viewer = await registerAndLand(browser);
  await viewer.goto('/clasificacion');
  await expect(
    viewer.getByRole('heading', { name: 'Clasificación' }),
  ).toBeVisible();

  const idxHigh = await rowIndexOf(viewer, nickT1High);
  const idxLow = await rowIndexOf(viewer, nickT1Low);

  expect(idxHigh).toBeGreaterThanOrEqual(0);
  expect(idxLow).toBeGreaterThanOrEqual(0);
  // Mismos puntos totales (60), pero §7.1 coloca arriba al de más exactos.
  expect(idxHigh).toBeLessThan(idxLow);

  // El desempate de §7.1 SÍ resuelve el orden → ninguno queda pendiente de sorteo.
  const rowHigh = viewer.getByTestId('ranking-row').filter({ hasText: nickT1High });
  const rowLow = viewer.getByTestId('ranking-row').filter({ hasText: nickT1Low });
  await expect(rowHigh.getByText('empate')).toHaveCount(0);
  await expect(rowLow.getByText('empate')).toHaveCount(0);
});
