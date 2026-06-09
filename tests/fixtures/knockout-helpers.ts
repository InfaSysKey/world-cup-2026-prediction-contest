/**
 * Semilla de predicciones de bracket para los tests e2e que necesitan un estado
 * previo de eliminatorias ANTES de que exista el tab de bracket (sub-slice 4.5).
 *
 * Toca la BD directamente (import relativo de lib/db, sin alias @/, porque el
 * loader de Playwright no lee los paths de tsconfig). El .env lo carga
 * playwright.config.ts, así que DATABASE_URL está disponible. Es código de test:
 * no añade superficie a producción.
 */
import { asc, eq } from 'drizzle-orm';

import {
  db,
  matches,
  predictionsKnockout,
  users,
  type Phase,
} from '../../lib/db';

async function userIdByEmail(email: string): Promise<number> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (!row) {
    throw new Error(`seedKnockoutWinner: no existe usuario con email ${email}`);
  }
  return row.id;
}

async function matchIdByPhase(phase: Phase): Promise<number> {
  const [row] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.phase, phase));
  if (!row) {
    throw new Error(`seedKnockoutWinner: no existe partido de fase ${phase}`);
  }
  return row.id;
}

/**
 * Inserta (o actualiza) la predicción del ganador de un partido de eliminatorias
 * para el usuario indicado. Idempotente sobre (user, match).
 */
export async function seedKnockoutWinner(
  email: string,
  phase: Phase,
  winnerTeamCode: string,
): Promise<void> {
  const [userId, matchId] = await Promise.all([
    userIdByEmail(email),
    matchIdByPhase(phase),
  ]);

  await db
    .insert(predictionsKnockout)
    .values({ userId, matchId, winnerTeamCode })
    .onConflictDoUpdate({
      target: [predictionsKnockout.userId, predictionsKnockout.matchId],
      set: { winnerTeamCode, updatedAt: new Date() },
    });
}

/**
 * Siembra el bracket mínimo del que `deducePodium` saca los 3 puestos: las 2
 * semifinales (ganadas por `champion` y `runnerUp`), la final (ganada por
 * `champion`) y el 3-4 (ganado por `third`). Así el subcampeón es deducible
 * (necesita 2 semis y que el campeón figure en ellas). Idempotente por (user,
 * match).
 */
export async function seedPodiumBracket(
  email: string,
  champion: string,
  runnerUp: string,
  third: string,
): Promise<void> {
  const userId = await userIdByEmail(email);
  const semis = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.phase, 'semi'))
    .orderBy(asc(matches.id));
  if (semis.length < 2) {
    throw new Error('seedPodiumBracket: se esperaban 2 semifinales en el seed');
  }
  const [finalId, thirdId] = await Promise.all([
    matchIdByPhase('final'),
    matchIdByPhase('3-4'),
  ]);

  const rows = [
    { matchId: semis[0].id, winnerTeamCode: champion },
    { matchId: semis[1].id, winnerTeamCode: runnerUp },
    { matchId: finalId, winnerTeamCode: champion },
    { matchId: thirdId, winnerTeamCode: third },
  ];

  for (const r of rows) {
    await db
      .insert(predictionsKnockout)
      .values({ userId, matchId: r.matchId, winnerTeamCode: r.winnerTeamCode })
      .onConflictDoUpdate({
        target: [predictionsKnockout.userId, predictionsKnockout.matchId],
        set: { winnerTeamCode: r.winnerTeamCode, updatedAt: new Date() },
      });
  }
}
