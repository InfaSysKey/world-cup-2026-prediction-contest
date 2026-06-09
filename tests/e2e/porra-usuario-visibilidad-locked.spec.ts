/**
 * E2E de visibilidad (slice 7.3) en modo BLOQUEADO. Corre solo con el project
 * "locked" (npm run e2e:locked), que arranca el servidor con
 * TOURNAMENT_START_AT=2020-01-01 (en el pasado): TODO está bloqueado, así que la
 * porra de otro usuario SÍ es pública (scoring-rules.md §8). Es el caso positivo
 * complementario a usuario-visibilidad.spec.ts (caso negativo, modo abierto).
 *
 * El nombre `porra-*-locked.spec.ts` es obligatorio para que el testMatch del
 * project "locked" lo recoja (ver playwright.config.ts).
 */
import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';

import { db, predictionsGroupMatches, users } from '@/lib/db';

import { registerAndLand, uniqueSuffix } from '../fixtures/auth-helpers';

let targetNickname: string;
let targetId: number;

test.beforeAll(async () => {
  const suffix = uniqueSuffix();
  targetNickname = `vis_locked_${suffix}`;
  const [created] = await db
    .insert(users)
    .values({
      email: `vis_locked_${suffix}@test.dev`,
      passwordHash: 'x',
      nombre: 'Vis',
      apellidos: 'Locked',
      nickname: targetNickname,
      isAdmin: false,
    })
    .returning({ id: users.id });
  targetId = created.id;

  await db.insert(predictionsGroupMatches).values({
    userId: targetId,
    matchId: 1,
    golesLocal: 7,
    golesVisitante: 7,
  });
});

test.afterAll(async () => {
  await db.delete(users).where(eq(users.id, targetId));
});

test('la predicción bloqueada de otro usuario SÍ es visible (§8)', async ({
  browser,
}) => {
  const viewer = await registerAndLand(browser);

  await viewer.goto(`/usuario/${targetNickname}`);

  // Ya bloqueada: no hay candado en marcadores y el marcador sembrado se ve.
  await expect(viewer.getByTestId('ro-groupMatches-locked')).toHaveCount(0);
  await expect(viewer.getByText('7 - 7')).toBeVisible();
});
