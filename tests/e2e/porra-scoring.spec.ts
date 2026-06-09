/**
 * E2E del motor de puntuación contra Postgres REAL (slice 5). Lo que vitest no
 * puede cubrir porque allí la BD está mockeada:
 *   1. Idempotencia: ejecutar calculateUserScore dos veces deja las filas de
 *      `scores` con los MISMOS points + detail (calculated_at es metadato).
 *   2. Recálculo selectivo: editar UN resultado y llamar a
 *      recalculateAfterResultChange solo reescribe la fila de la categoría
 *      afectada; las demás conservan points, detail y calculated_at intactos.
 *
 * No usa navegador: importa el orquestador y el cliente Drizzle directamente
 * (Playwright 1.60 resuelve el alias @/). Es código de test contra la BD del e2e.
 */
import { expect, test } from '@playwright/test';
import { and, asc, desc, eq, gt } from 'drizzle-orm';

import {
  db,
  matches,
  predictionsKnockout,
  scoreRecalculations,
  scores,
  users,
} from '@/lib/db';
import {
  calculateUserScore,
  recalculateAfterResultChange,
} from '@/lib/scoring';

import { uniqueSuffix } from '../fixtures/auth-helpers';
import { seedFullCoherentPorra } from '../fixtures/standings-helpers';

type ScoreSnapshot = {
  category: string;
  points: number;
  detail: unknown;
  calculatedAt: Date;
};

let userId: number;
let adminId: number;
let email: string;
let koMatchId: number;
let preRecalcMaxId: number;
// Matches de grupos cuyos resultados sembramos (a restaurar en el cleanup).
const TOUCHED_GROUP_MATCHES = [1, 2, 3];

async function readScores(uid: number): Promise<ScoreSnapshot[]> {
  return db
    .select({
      category: scores.category,
      points: scores.points,
      detail: scores.detail,
      calculatedAt: scores.calculatedAt,
    })
    .from(scores)
    .where(eq(scores.userId, uid))
    .orderBy(asc(scores.category));
}

function meaningful(rows: ScoreSnapshot[]) {
  return rows.map((r) => ({
    category: r.category,
    points: r.points,
    detail: r.detail,
  }));
}

test.beforeAll(async () => {
  const suffix = uniqueSuffix();
  email = `scoring-${suffix}@test.dev`;

  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isAdmin, true))
    .limit(1);
  if (!admin) {
    throw new Error('e2e scoring: no hay usuario admin (¿falta admin:bootstrap?)');
  }
  adminId = admin.id;

  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash: 'x',
      nombre: 'Scoring',
      apellidos: 'Tester',
      nickname: `scoring-${suffix}`,
      isAdmin: false,
    })
    .returning({ id: users.id });
  userId = created.id;

  // Porra completa y coherente (sin huecos → penalties 0).
  await seedFullCoherentPorra(email);

  // Resultados oficiales de 3 partidos de grupos. El usuario predijo todos 1-0
  // (seedFullCoherentPorra), así que:
  //   m1 1-0 → exacto (+5); m2 2-0 → acierto de 1X2 (+3); m3 0-2 → fallo (0).
  await db
    .update(matches)
    .set({ realGolesLocal: 1, realGolesVisitante: 0, status: 'finished' })
    .where(eq(matches.id, 1));
  await db
    .update(matches)
    .set({ realGolesLocal: 2, realGolesVisitante: 0, status: 'finished' })
    .where(eq(matches.id, 2));
  await db
    .update(matches)
    .set({ realGolesLocal: 0, realGolesVisitante: 2, status: 'finished' })
    .where(eq(matches.id, 3));

  // Un cruce de 1/16 ganado por el equipo que el usuario predijo → bracket +4.
  const [ko] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.phase, '1/16'))
    .orderBy(asc(matches.id))
    .limit(1);
  koMatchId = ko.id;
  const [pick] = await db
    .select({ winnerTeamCode: predictionsKnockout.winnerTeamCode })
    .from(predictionsKnockout)
    .where(
      and(
        eq(predictionsKnockout.userId, userId),
        eq(predictionsKnockout.matchId, koMatchId),
      ),
    );
  await db
    .update(matches)
    .set({ realWinnerTeamCode: pick.winnerTeamCode, status: 'finished' })
    .where(eq(matches.id, koMatchId));

  const [maxRow] = await db
    .select({ id: scoreRecalculations.id })
    .from(scoreRecalculations)
    .orderBy(desc(scoreRecalculations.id))
    .limit(1);
  preRecalcMaxId = maxRow?.id ?? 0;
});

test.afterAll(async () => {
  // Borra las filas de auditoría creadas por este test.
  await db
    .delete(scoreRecalculations)
    .where(gt(scoreRecalculations.id, preRecalcMaxId));
  // Borra el usuario de prueba (cascade elimina predicciones y scores).
  await db.delete(users).where(eq(users.id, userId));
  // Restaura los partidos de grupos tocados a su estado de seed.
  for (const id of TOUCHED_GROUP_MATCHES) {
    await db
      .update(matches)
      .set({
        realGolesLocal: null,
        realGolesVisitante: null,
        realWinnerTeamCode: null,
        status: 'scheduled',
      })
      .where(eq(matches.id, id));
  }
  await db
    .update(matches)
    .set({ realWinnerTeamCode: null, status: 'scheduled' })
    .where(eq(matches.id, koMatchId));
});

test.describe.serial('motor de puntuación contra Postgres real', () => {
  test('calculateUserScore es idempotente: dos corridas dejan idénticos points y detail', async () => {
    await calculateUserScore(userId);
    const first = await readScores(userId);

    await calculateUserScore(userId);
    const second = await readScores(userId);

    // Las 7 categorías presentes, y la fila de grupos con el cálculo esperado.
    expect(first).toHaveLength(7);
    const groupMatches = first.find((r) => r.category === 'group_matches');
    expect(groupMatches?.points).toBe(8); // 5 + 3 + 0

    // Estado significativo idéntico (calculated_at es metadato y puede variar).
    expect(meaningful(second)).toEqual(meaningful(first));
  });

  test('recalculateAfterResultChange solo reescribe la categoría afectada', async () => {
    // Baseline: recálculo completo con calculated_at conocido por fila.
    await calculateUserScore(userId);
    const baseline = await readScores(userId);
    const baseAt = new Map(
      baseline.map((r) => [r.category, r.calculatedAt.getTime()]),
    );
    const basePoints = new Map(baseline.map((r) => [r.category, r.points]));

    // Edita el resultado de m1 (1-0 → 0-2): grupos pasa de 8 a 3 (0 + 3 + 0).
    await db
      .update(matches)
      .set({ realGolesLocal: 0, realGolesVisitante: 2, status: 'finished' })
      .where(eq(matches.id, 1));
    await recalculateAfterResultChange(
      { type: 'group_match', matchId: 1 },
      adminId,
    );

    const after = await readScores(userId);

    for (const row of after) {
      if (row.category === 'group_matches') {
        // Recalculada: nuevo valor y calculated_at no anterior al baseline.
        expect(row.points).toBe(3);
        expect(row.calculatedAt.getTime()).toBeGreaterThanOrEqual(
          baseAt.get('group_matches') ?? 0,
        );
      } else {
        // Intacta: mismos puntos y EXACTAMENTE el mismo calculated_at (no tocada).
        expect(row.points).toBe(basePoints.get(row.category));
        expect(row.calculatedAt.getTime()).toBe(baseAt.get(row.category));
      }
    }

    // Se registró exactamente una fila de auditoría, de la categoría afectada.
    const audit = await db
      .select({
        affectedCategories: scoreRecalculations.affectedCategories,
        usersAffected: scoreRecalculations.usersAffected,
        triggeredBy: scoreRecalculations.triggeredBy,
      })
      .from(scoreRecalculations)
      .where(gt(scoreRecalculations.id, preRecalcMaxId));
    expect(audit).toHaveLength(1);
    expect(audit[0].affectedCategories).toEqual(['group_matches']);
    expect(audit[0].triggeredBy).toBe(adminId);
  });
});
