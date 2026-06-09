/**
 * E2E de seguridad (slice 7.3): la porra de OTRO usuario solo muestra
 * predicciones ya BLOQUEADAS (scoring-rules.md §8). Este spec corre en modo
 * ABIERTO (servidor por defecto, TOURNAMENT_START_AT en el futuro), donde NADA
 * está bloqueado todavía: por tanto el visitante NO debe ver ninguna predicción
 * del objetivo, ni siquiera un marcador concreto que sembramos a propósito.
 *
 * Es el test del punto de fuga: prueba end-to-end que una predicción abierta de
 * otro jugador no llega al cliente.
 */
import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';

import { db, predictionsGroupMatches, users } from '@/lib/db';

import { registerAndLand, uniqueSuffix } from '../fixtures/auth-helpers';

let targetNickname: string;
let targetId: number;

test.beforeAll(async () => {
  const suffix = uniqueSuffix();
  targetNickname = `vis_target_${suffix}`;
  const [created] = await db
    .insert(users)
    .values({
      email: `vis_target_${suffix}@test.dev`,
      passwordHash: 'x',
      nombre: 'Vis',
      apellidos: 'Target',
      nickname: targetNickname,
      isAdmin: false,
    })
    .returning({ id: users.id });
  targetId = created.id;

  // Marcador reconocible e improbable que NO debe filtrarse en modo abierto.
  await db.insert(predictionsGroupMatches).values({
    userId: targetId,
    matchId: 1,
    golesLocal: 7,
    golesVisitante: 7,
  });
});

test.afterAll(async () => {
  await db.delete(users).where(eq(users.id, targetId)); // cascade borra predicciones
});

test('no se ve la predicción NO bloqueada de otro usuario (§8)', async ({
  browser,
}) => {
  const viewer = await registerAndLand(browser);

  await viewer.goto(`/usuario/${targetNickname}`);
  await expect(
    viewer.getByRole('heading', { name: `Porra de ${targetNickname}` }),
  ).toBeVisible();

  // La sección de marcadores muestra el candado, no el contenido.
  await expect(viewer.getByTestId('ro-groupMatches-locked')).toBeVisible();
  // Y el marcador sembrado NO aparece por ningún lado.
  await expect(viewer.getByText('7 - 7')).toHaveCount(0);
});
