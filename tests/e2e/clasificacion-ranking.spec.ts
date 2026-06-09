/**
 * E2E de la clasificación (slice 7.2): dos usuarios con puntuaciones distintas
 * aparecen en /clasificacion en el orden correcto (más puntos arriba). Siembra
 * las filas de `scores` directamente (el motor de puntuación es slice 5 y ya
 * tiene su propio e2e); aquí se prueba la VISTA: query del ranking + rankPlayers
 * + render. Corre en modo abierto con un visitante autenticado por el flujo real.
 */
import { expect, test } from '@playwright/test';
import { inArray } from 'drizzle-orm';

import { db, scores, users } from '@/lib/db';

import { registerAndLand, uniqueSuffix } from '../fixtures/auth-helpers';

let nickHigh: string;
let nickLow: string;
const createdIds: number[] = [];

async function createPlayer(
  nickname: string,
  points: number,
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
  await db.insert(scores).values({
    userId: created.id,
    category: 'group_matches',
    points,
    detail: { reasons: { exact: 0, result: 0, one_goal: 0, wrong: 0 }, gaps: 0 },
  });
  return created.id;
}

test.beforeAll(async () => {
  const suffix = uniqueSuffix();
  nickHigh = `rank_high_${suffix}`;
  nickLow = `rank_low_${suffix}`;
  createdIds.push(await createPlayer(nickHigh, 100));
  createdIds.push(await createPlayer(nickLow, 40));
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
